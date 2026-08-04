package com.microboxlabs.miot.integrations.calendar;

import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import com.microboxlabs.miot.integrations.service.EventBindingFetchService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * {@link ModulithJobHandler} for {@code calendar_sync}: translates a
 * self-contained payload into miot-calendar calls. Ported verbatim from ECM's
 * {@code CalendarSyncJobExecutor} — the moved runtime is the only change.
 *
 * <p>Outcome policy: 409 (status regression — a newer status already applied by
 * an out-of-order sibling) is a benign SKIP; transport / 5xx / network
 * ({@code -1}) errors are thrown so the worker reports FAILED and the ledger
 * retries with backoff. miot-calendar only moves statuses forward, so unordered
 * jobs converge on the max status. A patch 404 (no booking) creates the booking
 * and applies the status when the payload carries an ETD and the target is
 * non-terminal (see {@code materializeFromPatch}); otherwise it too is a benign
 * SKIP.
 *
 * <p><b>Except when a regression is the point.</b> The workflow is not
 * monotonic — a service can go back from {@code presentDriver} to
 * {@code assignDriver} — so {@link CalendarSyncFeature#OP_UNASSIGN} exists to
 * carry that revert, and it reads 409 the opposite way: not "this job is late"
 * but "the booking has run ahead of the workflow". See
 * {@code executeUnassign}.
 *
 * <p><b>Slot 409s on ensure are different again.</b> A 409 on an
 * <b>ensure move/create into an explicit slot</b> means that slot rejected the
 * placement (e.g. it is at full capacity) — retrying the same slot cannot
 * converge, so it is thrown as a {@link NonRetryableJobException} and parked
 * immediately (alerting the planner) rather than retried. The one exception is a
 * create 409 where a sibling won the race and a booking now exists: that re-runs
 * (retryable) and converges via the move path. The ETD <b>auto-pick</b>
 * no-capacity case stays retryable and self-heals separately (see
 * {@code pickSlotFromEtd}).
 */
@ApplicationScoped
public class CalendarSyncExecutor implements ModulithJobHandler {

    private static final Logger LOG = Logger.getLogger(CalendarSyncExecutor.class);

    /** ETD auto-pick horizon — matches ECM's stale-planned cleanup window (#257). */
    private static final int SLOT_SEARCH_WINDOW_HOURS = 48;
    private static final Comparator<CalendarBookingsClient.AvailableSlot> SLOT_ORDER = Comparator
            .comparing(CalendarBookingsClient.AvailableSlot::date)
            .thenComparingInt(CalendarBookingsClient.AvailableSlot::hour)
            .thenComparingInt(CalendarBookingsClient.AvailableSlot::minutes);

    private final CalendarBookingsClient client;
    private final EventBindingFetchService enrichment;
    private final Clock clock;

    @Inject
    CalendarSyncExecutor(CalendarBookingsClient client, EventBindingFetchService enrichment) {
        this(client, enrichment, Clock.systemDefaultZone());
    }

    CalendarSyncExecutor(CalendarBookingsClient client, EventBindingFetchService enrichment, Clock clock) {
        this.client = client;
        this.enrichment = enrichment;
        this.clock = clock;
    }

    @Override
    public String jobType() {
        return CalendarSyncFeature.JOB_TYPE;
    }

    /** Not ready until the miot-calendar base URL is configured. */
    @Override
    public boolean isReady() {
        return client.isConfigured();
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        String op = str(payload, CalendarSyncFeature.PAYLOAD_OP);
        String resourceId = str(payload, CalendarSyncFeature.PAYLOAD_RESOURCE_ID);
        String calendarIdRaw = str(payload, CalendarSyncFeature.PAYLOAD_CALENDAR_ID);
        if (op == null || resourceId == null) {
            throw new IllegalArgumentException("calendar_sync payload missing op/resourceId");
        }
        UUID calendarId = calendarIdRaw == null ? null : UUID.fromString(calendarIdRaw);

        if (CalendarSyncFeature.OP_PATCH.equals(op)) {
            Enriched enriched = enrich(tenantCode, payload, calendarIdRaw);
            return withResult(executePatch(enriched.payload(), resourceId, calendarId), enriched);
        }
        if (CalendarSyncFeature.OP_ENSURE.equals(op)) {
            Enriched enriched = enrich(tenantCode, payload, calendarIdRaw);
            return withResult(executeEnsure(enriched.payload(), resourceId, calendarId), enriched);
        }
        if (CalendarSyncFeature.OP_UNASSIGN.equals(op)) {
            return executeUnassign(payload, resourceId, calendarId);
        }
        if (CalendarSyncFeature.OP_CANCEL.equals(op)) {
            return executeCancel(resourceId, calendarId);
        }
        throw new IllegalArgumentException("calendar_sync unknown op: " + op);
    }

    /**
     * Resolve extra resource-data through the calendar's enrichment binding, when one is
     * configured — the answer to a workflow that only carries human identifiers (RUTs,
     * plates) while the booking is keyed on resource ids. No binding, or a payload with
     * nothing the binding's mapping reads, changes nothing at all.
     *
     * <p>Fetched values are merged over the payload's own {@code resourceData} (fresh
     * resolution beats what rode along), on a copied payload — the original is the ledger's
     * record of what ECM sent. A configured fetch that fails throws instead, so the job
     * retries or parks visibly rather than writing a booking with silently missing data.
     */
    private Enriched enrich(String tenantCode, Map<String, Object> payload, String calendarIdRaw) {
        Optional<EventBindingFetchService.FetchedValues> fetched = enrichment.fetch(
                tenantCode,
                CalendarSyncFeature.EVENT_RESOURCE_ENRICHMENT,
                CalendarSyncFeature.SCOPE_CALENDAR,
                calendarIdRaw,
                payload);
        if (fetched.isEmpty() || fetched.get().values().isEmpty()) {
            return new Enriched(payload, null);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        Map<String, Object> existing = asMap(payload.get(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA));
        if (existing != null) {
            data.putAll(existing);
        }
        data.putAll(fetched.get().values());

        Map<String, Object> enrichedPayload = new LinkedHashMap<>(payload);
        enrichedPayload.put(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA, data);
        LOG.infof("calendar_sync enrichment resolved %d value(s) via binding %s for %s",
                fetched.get().values().size(), fetched.get().bindingId(),
                str(payload, CalendarSyncFeature.PAYLOAD_RESOURCE_ID));
        return new Enriched(enrichedPayload, Map.of(
                "enrichment", fetched.get().values(),
                "bindingId", fetched.get().bindingId()));
    }

    /** Attach what enrichment resolved to a successful outcome, for the job's result column. */
    private static JobOutcome withResult(JobOutcome outcome, Enriched enriched) {
        if (enriched.result() == null || !JobOutcome.SUCCEEDED.equals(outcome.outcome())) {
            return outcome;
        }
        return new JobOutcome(outcome.outcome(), outcome.detail(), enriched.result());
    }

    /** A payload with enrichment applied, and what was resolved (null when nothing was). */
    private record Enriched(Map<String, Object> payload, Map<String, Object> result) {
    }

    /**
     * Reset the booking to PLANNED and clear the assignment keys, keeping the
     * slot — the {@code presentDriver → assignDriver} revert.
     *
     * <p>Outcome policy differs from {@link #executePatch} on purpose, because
     * the two 409s mean opposite things. There, a 409 says the job lost a race
     * and a newer status already won, so skipping is right. Here the job is on
     * time and the regression <b>is</b> the intent, so a 409 says the booking
     * has run ahead of the workflow — past ASSIGNED, truck already moving. No
     * retry makes that converge, so it is a terminal skip, logged loudly rather
     * than reported as a clean success.
     *
     * <p>404 stays quietly benign: the forward {@code planService →
     * assignDriver} path enqueues the same op with no booking yet to unassign.
     */
    private JobOutcome executeUnassign(Map<String, Object> payload, String resourceId, UUID calendarId) {
        List<String> clearDataKeys = asStringList(payload.get(CalendarSyncFeature.PAYLOAD_CLEAR_DATA_KEYS));
        try {
            client.unassignByResource(resourceId, calendarId, clearDataKeys);
            // An optional syncStatus rides the unassign (not the ensure): on the
            // backward revert the booking is at ASSIGNED, so the ensure leg's
            // PLANNED patch is refused as a regression and would drop the stamp
            // with it. The unassign is the one call that succeeds in both
            // directions, and it must also displace whatever sync verdict the
            // previous assignment left behind — a stale REJECTED belongs to a
            // tuple that no longer exists. Status-only patch: no 409 possible.
            String syncStatus = str(payload, CalendarSyncFeature.PAYLOAD_SYNC_STATUS);
            if (syncStatus != null) {
                client.patchByResource(resourceId, calendarId, null, null, syncStatus, null);
            }
            return JobOutcome.succeeded("Booking unassigned for " + resourceId
                    + " (cleared " + clearDataKeys.size() + " data key(s)"
                    + (syncStatus == null ? ")" : ", sync " + syncStatus + ")"));
        } catch (CalendarBookingsHttpException e) {
            if (e.getStatus() == 404) {
                return JobOutcome.skipped("No booking to unassign for " + resourceId);
            }
            if (e.getStatus() == 409) {
                LOG.warnf("calendar_sync unassign rejected for %s: the booking is past ASSIGNED while the "
                        + "workflow went back to assignDriver — calendar and workflow have diverged", resourceId);
                return JobOutcome.skipped("Unassign rejected for " + resourceId + " (booking past ASSIGNED)");
            }
            throw e;
        }
    }

    private JobOutcome executePatch(Map<String, Object> payload, String resourceId, UUID calendarId) {
        String targetStatus = str(payload, CalendarSyncFeature.PAYLOAD_TARGET_STATUS);
        String syncStatus = str(payload, CalendarSyncFeature.PAYLOAD_SYNC_STATUS);
        Map<String, Object> resourceData = asMap(payload.get(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA));
        try {
            client.patchByResource(resourceId, calendarId, targetStatus, resourceData, syncStatus, null);
            return JobOutcome.succeeded("Booking patched to " + targetStatus + " for " + resourceId);
        } catch (CalendarBookingsHttpException e) {
            if (e.getStatus() == 404) {
                JobOutcome materialized = materializeFromPatch(payload, resourceId, calendarId,
                        targetStatus, resourceData);
                if (materialized != null) {
                    return materialized;
                }
            }
            JobOutcome benign = benignSkip(e, resourceId, targetStatus);
            if (benign != null) {
                return benign;
            }
            throw e;
        }
    }

    /**
     * A patch that finds no booking used to be a benign skip in every case —
     * right for a straggler, wrong for a service that entered the workflow
     * without ever being planned through the calendar: each of its pushes 404'd
     * and it never appeared at all. When the patch carries an ETD (it rides
     * {@code resourceData} on every push), create the booking and then apply
     * the status, so the service materializes at whatever stage first touches
     * the calendar.
     *
     * <p>Returns {@code null} — falling back to the benign skip — in three cases:
     * <ul>
     *   <li><b>Terminal target.</b> A missing booking on a FINISHED/CANCELLED
     *       push is usually the cancel's own work (a future-slot cancel deletes
     *       the booking); creating one here would resurrect what was just
     *       released, only to close it. The modulith cannot consult the
     *       workflow, so terminal pushes never create.
     *   <li><b>No target status.</b> A data-only patch names no lifecycle stage
     *       — there is no "stage the service first touched" to materialize at.
     *   <li><b>No ETD.</b> Patch payloads carry no explicit slot, so without a
     *       parseable ETD there is nothing to place the booking at.
     * </ul>
     */
    private JobOutcome materializeFromPatch(Map<String, Object> payload, String resourceId,
                                            UUID calendarId, String targetStatus,
                                            Map<String, Object> resourceData) {
        if (calendarId == null || targetStatus == null
                || CalendarSyncFeature.isTerminalStatus(targetStatus)) {
            return null;
        }
        String etd = resourceData == null ? null
                : str(resourceData, CalendarSyncFeature.DATA_EXPECTED_DEPARTURE_DATE);
        if (etd == null) {
            return null;
        }
        Map<String, Object> createPayload = new LinkedHashMap<>(payload);
        createPayload.put(CalendarSyncFeature.PAYLOAD_ETD, etd);
        LOG.infof("calendar_sync patch: no booking for %s — materializing one from the patch "
                + "(etd=%s, target=%s)", resourceId, etd, targetStatus);
        return ensureCreate(createPayload, resourceId, calendarId, targetStatus, resourceData);
    }

    /**
     * Upsert the booking to match the kanban stage (Phase 2): create-if-absent at
     * the slot, re-slot an existing booking when an explicit slot differs, then set
     * the stage status. Idempotent by {@code (calendarId, resourceId)} so a retry or
     * an out-of-order push converges rather than duplicating.
     *
     * <p>Slot resolution is deliberately asymmetric: a create may auto-pick from the
     * ETD at <b>execute</b> time (a retry re-picks against fresh availability, so a
     * transient no-slot self-heals); an existing booking only moves for an
     * <b>explicit</b> slot (a real re-plan), never for the drifting ETD auto-pick.
     */
    private JobOutcome executeEnsure(Map<String, Object> payload, String resourceId, UUID calendarId) {
        if (calendarId == null) {
            throw new IllegalArgumentException("calendar_sync ensure requires a calendarId");
        }
        String targetStatus = str(payload, CalendarSyncFeature.PAYLOAD_TARGET_STATUS);
        Map<String, Object> resourceData = asMap(payload.get(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA));

        List<CalendarBookingsClient.BookingView> existing = client.listByResource(resourceId, calendarId);
        if (existing.isEmpty()) {
            return ensureCreate(payload, resourceId, calendarId, targetStatus, resourceData);
        }
        return ensureExisting(existing.get(0), payload, resourceId, calendarId, targetStatus, resourceData);
    }

    private JobOutcome ensureCreate(Map<String, Object> payload, String resourceId, UUID calendarId,
                                    String targetStatus, Map<String, Object> resourceData) {
        SlotInfo slot = resolveSlotForCreate(payload, calendarId, resourceId);
        if (slot == null) {
            // No explicit slot and no ETD (or an unparseable one): there is no slot
            // intent to act on. (An ETD with no free capacity throws instead — that
            // path retries and self-heals when a slot frees.)
            return JobOutcome.skipped("No slot intent to create booking for " + resourceId);
        }
        String resourceType = strOr(payload, CalendarSyncFeature.PAYLOAD_RESOURCE_TYPE,
                CalendarSyncFeature.DEFAULT_RESOURCE_TYPE);
        UUID bookingId;
        try {
            bookingId = client.create(calendarId, slot.date(), slot.hour(), slot.minutes(),
                    resourceId, resourceType, resourceData);
        } catch (CalendarBookingsHttpException e) {
            if (e.getStatus() == 409) {
                throw createConflict(e, resourceId, calendarId, slot);
            }
            throw e;
        }
        applyStatus(resourceId, calendarId, targetStatus,
                str(payload, CalendarSyncFeature.PAYLOAD_SYNC_STATUS));
        LOG.infof("calendar_sync ensure created booking %s for %s at %s %02d:%02d -> %s",
                bookingId, resourceId, slot.date(), slot.hour(), slot.minutes(), targetStatus);
        return JobOutcome.succeeded("Ensured (created) booking " + bookingId + " for " + resourceId
                + (targetStatus == null ? "" : " -> " + targetStatus));
    }

    private JobOutcome ensureExisting(CalendarBookingsClient.BookingView booking, Map<String, Object> payload,
                                      String resourceId, UUID calendarId,
                                      String targetStatus, Map<String, Object> resourceData) {
        boolean moved = false;
        SlotInfo explicit = resolveExplicitSlot(payload, calendarId);
        if (explicit != null && slotDiffers(booking, explicit)) {
            try {
                client.move(booking.id(), explicit.date(), explicit.hour(), explicit.minutes());
            } catch (CalendarBookingsHttpException e) {
                if (e.getStatus() == 409) {
                    // The chosen slot rejected the move (e.g. it is at full capacity).
                    // Retrying the same explicit slot cannot converge, so park now —
                    // the planner is alerted — instead of backing off to the same 409.
                    throw new NonRetryableJobException("Cannot move booking " + booking.id() + " for "
                            + resourceId + " to " + slotLabel(explicit) + " — rejected by calendar (409): "
                            + e.getMessage(), e);
                }
                throw e;
            }
            moved = true;
        }
        // Forward-only status, plus a shallow resource-data merge so a re-plan keeps
        // the row current. 404/409 are benign (raced delete / status regression).
        // The payload's syncStatus rides along (null leaves it untouched) — the
        // existing-booking path must not drop the confirmation window the push
        // opened, exactly like applyStatus on the create path.
        String syncStatus = str(payload, CalendarSyncFeature.PAYLOAD_SYNC_STATUS);
        if (targetStatus != null || syncStatus != null
                || (resourceData != null && !resourceData.isEmpty())) {
            try {
                client.patchByResource(resourceId, calendarId, targetStatus, resourceData, syncStatus, null);
            } catch (CalendarBookingsHttpException e) {
                if (benignSkip(e, resourceId, targetStatus) == null) {
                    throw e;
                }
            }
        }
        return JobOutcome.succeeded("Ensured (existing) booking " + booking.id() + " for " + resourceId
                + (moved ? " [moved]" : "") + (targetStatus == null ? "" : " -> " + targetStatus));
    }

    /**
     * Set the stage status on the booking we just created, carrying the
     * originating push's {@code syncStatus} (null leaves it untouched) — a
     * materialized patch must not lose the confirmation window its payload
     * opened. Unlike a status-only push, a 404 here is NOT benign — the booking
     * exists (we just created it), so a 404 is a visibility-lag anomaly;
     * propagate it so a retry (whose {@code listByResource} then finds the
     * booking) converges rather than reporting success with the status unset.
     * Only 409 (the create default already at/ahead of the target) is benign.
     */
    private void applyStatus(String resourceId, UUID calendarId, String targetStatus, String syncStatus) {
        if (targetStatus == null) {
            return;
        }
        try {
            client.patchByResource(resourceId, calendarId, targetStatus, null, syncStatus, null);
        } catch (CalendarBookingsHttpException e) {
            if (e.getStatus() != 409) {
                throw e;
            }
            LOG.infof("calendar_sync ensure: post-create status %s for %s rejected as regression (409) — booking "
                    + "already at/ahead of target", targetStatus, resourceId);
        }
    }

    /**
     * Slot for a create: an explicit slot from the payload wins; otherwise auto-pick
     * the next-available slot from the ETD at run time. Returns {@code null} when
     * there is no slot intent (no explicit slot and no/unparseable ETD); throws
     * (retryable) when an ETD is present but no slot has capacity.
     */
    private SlotInfo resolveSlotForCreate(Map<String, Object> payload, UUID calendarId, String resourceId) {
        SlotInfo explicit = resolveExplicitSlot(payload, calendarId);
        if (explicit != null) {
            return explicit;
        }
        String etdRaw = str(payload, CalendarSyncFeature.PAYLOAD_ETD);
        if (etdRaw == null) {
            return null;
        }
        LocalDateTime etd = parseEtd(etdRaw);
        if (etd == null) {
            LOG.warnf("calendar_sync ensure: unparseable etd '%s' for %s — skipping create", etdRaw, resourceId);
            return null;
        }
        return pickSlotFromEtd(etd, calendarId, resourceId);
    }

    /**
     * Earliest available slot in {@code [max(now, etd), +48h]}. Throws (retryable) if
     * none has capacity, so the job backs off and re-picks against fresh availability
     * — a transient no-slot self-heals when a slot frees.
     */
    private SlotInfo pickSlotFromEtd(LocalDateTime etd, UUID calendarId, String resourceId) {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime searchStart = etd.isAfter(now) ? etd : now;
        LocalDateTime searchEnd = searchStart.plusHours(SLOT_SEARCH_WINDOW_HOURS);
        List<CalendarBookingsClient.AvailableSlot> slots =
                client.listAvailableSlots(calendarId, searchStart.toLocalDate(), searchEnd.toLocalDate());
        var pick = slots.stream()
                .filter(s -> s.availableCapacity() > 0)
                .filter(s -> withinWindow(s, searchStart, searchEnd))
                .min(SLOT_ORDER);
        if (pick.isEmpty()) {
            throw new IllegalStateException(String.format(
                    "No available calendar slot for %s in [%s, %s] (etd=%s) — will retry",
                    resourceId, searchStart, searchEnd, etd));
        }
        var picked = pick.get();
        return new SlotInfo(calendarId, picked.date(), picked.hour(), picked.minutes());
    }

    /**
     * Cancel decided from the freshest slot: future slot → DELETE (release
     * capacity); past slot → PATCH CANCELLED (keep history). No matching
     * booking → SKIPPED.
     */
    private JobOutcome executeCancel(String resourceId, UUID calendarId) {
        List<CalendarBookingsClient.BookingView> bookings = client.listByResource(resourceId, calendarId);
        if (bookings.isEmpty()) {
            return JobOutcome.skipped("No booking to cancel for " + resourceId);
        }

        LocalDateTime now = LocalDateTime.now(clock);
        int deleted = 0;
        boolean pastRemains = false;
        for (var booking : bookings) {
            if (isFutureSlot(booking, now)) {
                deleted += tryDelete(booking, resourceId);
            } else {
                pastRemains = true;
            }
        }

        if (pastRemains) {
            try {
                client.patchByResource(resourceId, calendarId, CalendarSyncFeature.STATUS_CANCELLED, null);
            } catch (CalendarBookingsHttpException e) {
                if (benignSkip(e, resourceId, CalendarSyncFeature.STATUS_CANCELLED) == null) {
                    throw e;
                }
            }
        }
        return JobOutcome.succeeded(String.format(
                "Cancel applied for %s (deleted=%d, pastPatched=%b)", resourceId, deleted, pastRemains));
    }

    private int tryDelete(CalendarBookingsClient.BookingView booking, String resourceId) {
        try {
            client.cancel(booking.id());
            return 1;
        } catch (CalendarBookingsHttpException e) {
            if (e.getStatus() != 404) {
                throw e;
            }
            // Already gone (raced with an unplan) — nothing to release.
            LOG.infof("Booking %s already gone while cancelling %s", booking.id(), resourceId);
            return 0;
        }
    }

    /**
     * Classify a 409 from an ensure-create. Either the explicit slot rejected the
     * booking (e.g. full capacity) — terminal, since a retry hits the same wall —
     * or a sibling won the race and a booking now exists, in which case a re-run
     * converges via the move path. Re-list to tell them apart instead of coupling
     * to the calendar's error text. Returns the exception to throw.
     */
    private RuntimeException createConflict(CalendarBookingsHttpException e, String resourceId,
                                            UUID calendarId, SlotInfo slot) {
        if (client.listByResource(resourceId, calendarId).isEmpty()) {
            return new NonRetryableJobException("Cannot create booking for " + resourceId + " at "
                    + slotLabel(slot) + " — rejected by calendar (409): " + e.getMessage(), e);
        }
        LOG.infof("calendar_sync ensure: create 409 for %s but a booking now exists — a sibling won the "
                + "race; retrying to converge via the existing booking", resourceId);
        return e;
    }

    private static String slotLabel(SlotInfo slot) {
        return String.format("%s %02d:%02d", slot.date(), slot.hour(), slot.minutes());
    }

    /** 404/409 are benign for status pushes; anything else is not ours to absorb. */
    private static JobOutcome benignSkip(CalendarBookingsHttpException e, String resourceId, String targetStatus) {
        if (e.getStatus() == 404) {
            return JobOutcome.skipped("No booking for " + resourceId + " (status " + targetStatus + ")");
        }
        if (e.getStatus() == 409) {
            return JobOutcome.skipped("Status regression rejected for " + resourceId + " -> " + targetStatus
                    + " (a newer status already applied)");
        }
        return null;
    }

    private static boolean isFutureSlot(CalendarBookingsClient.BookingView booking, LocalDateTime now) {
        LocalDate date = booking.slotDate();
        if (date.isAfter(now.toLocalDate())) {
            return true;
        }
        if (date.isBefore(now.toLocalDate())) {
            return false;
        }
        return LocalTime.of(booking.slotHour(), booking.slotMinutes()).isAfter(now.toLocalTime());
    }

    /**
     * Explicit slot from the payload. All-or-nothing: {@code null} only when
     * date/hour/minutes are ALL absent (no explicit intent → the caller may fall
     * back to the ETD). An <b>incomplete</b> slot (some present, some absent) is a
     * malformed payload — reject it rather than silently falling back to an ETD
     * auto-pick that would book an unintended slot.
     */
    private static SlotInfo resolveExplicitSlot(Map<String, Object> payload, UUID calendarId) {
        String date = str(payload, CalendarSyncFeature.PAYLOAD_SLOT_DATE);
        Object hour = payload.get(CalendarSyncFeature.PAYLOAD_SLOT_HOUR);
        Object minutes = payload.get(CalendarSyncFeature.PAYLOAD_SLOT_MINUTES);
        if (date == null && hour == null && minutes == null) {
            return null;
        }
        if (date == null || hour == null || minutes == null) {
            throw new IllegalArgumentException(
                    "calendar_sync ensure: incomplete explicit slot (slotDate/slotHour/slotMinutes must be "
                            + "all-or-nothing): slotDate=" + date + " slotHour=" + hour + " slotMinutes=" + minutes);
        }
        return new SlotInfo(calendarId, LocalDate.parse(date), toInt(hour), toInt(minutes));
    }

    private static boolean withinWindow(CalendarBookingsClient.AvailableSlot slot,
                                        LocalDateTime start, LocalDateTime end) {
        LocalDateTime dt = LocalDateTime.of(slot.date(), LocalTime.of(slot.hour(), slot.minutes()));
        return !dt.isBefore(start) && !dt.isAfter(end);
    }

    private static boolean slotDiffers(CalendarBookingsClient.BookingView booking, SlotInfo slot) {
        return !booking.slotDate().equals(slot.date())
                || booking.slotHour() != slot.hour()
                || booking.slotMinutes() != slot.minutes();
    }

    /** Accepts an offset datetime ({@code …+00:00}/{@code …Z}) or a local one; null if neither parses. */
    private static LocalDateTime parseEtd(String raw) {
        String text = raw.trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(text).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (RuntimeException ignored) {
            // fall through to local-datetime interpretation
        }
        try {
            return LocalDateTime.parse(text);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static int toInt(Object raw) {
        if (raw instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(raw.toString().trim());
    }

    private static String str(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        return value == null ? null : value.toString();
    }

    private static String strOr(Map<String, Object> payload, String key, String fallback) {
        String value = str(payload, key);
        return value == null ? fallback : value;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : null;
    }

    /**
     * Payload list of resource-data keys, normalized: never null, no null or
     * blank entries. Unlike {@link #asMap} this returns an empty list rather
     * than null, because an unassign with nothing to clear is a valid job (it
     * resets the lifecycle and leaves the payload alone).
     */
    private static List<String> asStringList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        return list.stream()
                .filter(java.util.Objects::nonNull)
                .map(Object::toString)
                .filter(s -> !s.isBlank())
                .toList();
    }

    /** Resolved slot for an ensure create/move. */
    private record SlotInfo(UUID calendarId, LocalDate date, int hour, int minutes) {
    }
}

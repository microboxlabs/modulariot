package com.microboxlabs.miot.integrations.calendar;

import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * {@link ModulithJobHandler} for {@code calendar_sync}: translates a
 * self-contained payload into miot-calendar calls. Ported verbatim from ECM's
 * {@code CalendarSyncJobExecutor} — the moved runtime is the only change.
 *
 * <p>Outcome policy: 404 (no booking) and 409 (status regression — a newer
 * status already applied by an out-of-order sibling) are benign SKIPs; transport
 * / 5xx / network ({@code -1}) errors are thrown so the worker reports FAILED and
 * the ledger retries with backoff. miot-calendar only moves statuses forward, so
 * unordered jobs converge on the max status.
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
    private final Clock clock;

    @Inject
    CalendarSyncExecutor(CalendarBookingsClient client) {
        this(client, Clock.systemDefaultZone());
    }

    CalendarSyncExecutor(CalendarBookingsClient client, Clock clock) {
        this.client = client;
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
    public JobOutcome handle(Map<String, Object> payload) {
        String op = str(payload, CalendarSyncFeature.PAYLOAD_OP);
        String resourceId = str(payload, CalendarSyncFeature.PAYLOAD_RESOURCE_ID);
        String calendarIdRaw = str(payload, CalendarSyncFeature.PAYLOAD_CALENDAR_ID);
        if (op == null || resourceId == null) {
            throw new IllegalArgumentException("calendar_sync payload missing op/resourceId");
        }
        UUID calendarId = calendarIdRaw == null ? null : UUID.fromString(calendarIdRaw);

        if (CalendarSyncFeature.OP_PATCH.equals(op)) {
            return executePatch(payload, resourceId, calendarId);
        }
        if (CalendarSyncFeature.OP_ENSURE.equals(op)) {
            return executeEnsure(payload, resourceId, calendarId);
        }
        if (CalendarSyncFeature.OP_CANCEL.equals(op)) {
            return executeCancel(resourceId, calendarId);
        }
        throw new IllegalArgumentException("calendar_sync unknown op: " + op);
    }

    private JobOutcome executePatch(Map<String, Object> payload, String resourceId, UUID calendarId) {
        String targetStatus = str(payload, CalendarSyncFeature.PAYLOAD_TARGET_STATUS);
        Map<String, Object> resourceData = asMap(payload.get(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA));
        try {
            client.patchByResource(resourceId, calendarId, targetStatus, resourceData);
            return JobOutcome.succeeded("Booking patched to " + targetStatus + " for " + resourceId);
        } catch (CalendarBookingsHttpException e) {
            JobOutcome benign = benignSkip(e, resourceId, targetStatus);
            if (benign != null) {
                return benign;
            }
            throw e;
        }
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
        UUID bookingId = client.create(calendarId, slot.date(), slot.hour(), slot.minutes(),
                resourceId, resourceType, resourceData);
        applyStatus(resourceId, calendarId, targetStatus);
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
            client.move(booking.id(), explicit.date(), explicit.hour(), explicit.minutes());
            moved = true;
        }
        // Forward-only status, plus a shallow resource-data merge so a re-plan keeps
        // the row current. 404/409 are benign (raced delete / status regression).
        if (targetStatus != null || (resourceData != null && !resourceData.isEmpty())) {
            try {
                client.patchByResource(resourceId, calendarId, targetStatus, resourceData);
            } catch (CalendarBookingsHttpException e) {
                if (benignSkip(e, resourceId, targetStatus) == null) {
                    throw e;
                }
            }
        }
        return JobOutcome.succeeded("Ensured (existing) booking " + booking.id() + " for " + resourceId
                + (moved ? " [moved]" : "") + (targetStatus == null ? "" : " -> " + targetStatus));
    }

    /** Set the stage status after a create; benign-skip a raced 404/409. */
    private void applyStatus(String resourceId, UUID calendarId, String targetStatus) {
        if (targetStatus == null) {
            return;
        }
        try {
            client.patchByResource(resourceId, calendarId, targetStatus, null);
        } catch (CalendarBookingsHttpException e) {
            if (benignSkip(e, resourceId, targetStatus) == null) {
                throw e;
            }
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

    /** Explicit slot from the payload, or {@code null} if any of date/hour/minutes is absent. */
    private static SlotInfo resolveExplicitSlot(Map<String, Object> payload, UUID calendarId) {
        String date = str(payload, CalendarSyncFeature.PAYLOAD_SLOT_DATE);
        Object hour = payload.get(CalendarSyncFeature.PAYLOAD_SLOT_HOUR);
        Object minutes = payload.get(CalendarSyncFeature.PAYLOAD_SLOT_MINUTES);
        if (date == null || hour == null || minutes == null) {
            return null;
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

    /** Resolved slot for an ensure create/move. */
    private record SlotInfo(UUID calendarId, LocalDate date, int hour, int minutes) {
    }
}

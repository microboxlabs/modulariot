package com.microboxlabs.miot.integrations.calendar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import com.microboxlabs.miot.integrations.service.EventBindingFetchService;

/**
 * Outcome policy for the ported calendar_sync executor: patch success/benign-skip/
 * retry, and the cancel future-vs-past decision. Uses a hand-rolled fake client
 * (no Mockito on this module) and a fixed clock.
 */
class CalendarSyncExecutorTest {

    private static final UUID CAL = UUID.fromString("3b4808f2-68ae-4b45-b921-f5a012a8962a");
    private static final String RESOURCE = "1658427-V";
    // now = 2026-07-15T12:00Z
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-15T12:00:00Z"), ZoneOffset.UTC);

    /** No enrichment binding configured — the pre-binding behaviour every existing test assumes. */
    private static final EventBindingFetchService NO_ENRICHMENT = new EventBindingFetchService(
            null, null, null, null) {
        @Override
        public Optional<FetchedValues> fetch(String tenantClientId, String eventType,
                String scopeKind, String scopeKey, Map<String, Object> context) {
            return Optional.empty();
        }
    };

    private static Map<String, Object> patchPayload(String status) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarSyncFeature.PAYLOAD_OP, CalendarSyncFeature.OP_PATCH);
        p.put(CalendarSyncFeature.PAYLOAD_RESOURCE_ID, RESOURCE);
        p.put(CalendarSyncFeature.PAYLOAD_CALENDAR_ID, CAL.toString());
        p.put(CalendarSyncFeature.PAYLOAD_TARGET_STATUS, status);
        return p;
    }

    private static final List<String> CLEAR_KEYS = List.of("assignedDriver", "assignedTruck");

    private static Map<String, Object> unassignPayload(List<String> clearDataKeys) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarSyncFeature.PAYLOAD_OP, CalendarSyncFeature.OP_UNASSIGN);
        p.put(CalendarSyncFeature.PAYLOAD_RESOURCE_ID, RESOURCE);
        p.put(CalendarSyncFeature.PAYLOAD_CALENDAR_ID, CAL.toString());
        if (clearDataKeys != null) {
            p.put(CalendarSyncFeature.PAYLOAD_CLEAR_DATA_KEYS, clearDataKeys);
        }
        return p;
    }

    private static Map<String, Object> cancelPayload() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarSyncFeature.PAYLOAD_OP, CalendarSyncFeature.OP_CANCEL);
        p.put(CalendarSyncFeature.PAYLOAD_RESOURCE_ID, RESOURCE);
        p.put(CalendarSyncFeature.PAYLOAD_CALENDAR_ID, CAL.toString());
        return p;
    }

    private static CalendarBookingsClient.BookingView booking(LocalDate date) {
        return new CalendarBookingsClient.BookingView(
                UUID.randomUUID(), CAL, date, 9, 0, "ASSIGNED");
    }

    private static Map<String, Object> ensurePayload(String status) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarSyncFeature.PAYLOAD_OP, CalendarSyncFeature.OP_ENSURE);
        p.put(CalendarSyncFeature.PAYLOAD_RESOURCE_ID, RESOURCE);
        p.put(CalendarSyncFeature.PAYLOAD_CALENDAR_ID, CAL.toString());
        p.put(CalendarSyncFeature.PAYLOAD_TARGET_STATUS, status);
        return p;
    }

    private static Map<String, Object> withExplicitSlot(Map<String, Object> p, LocalDate date, int hour, int min) {
        p.put(CalendarSyncFeature.PAYLOAD_SLOT_DATE, date.toString());
        p.put(CalendarSyncFeature.PAYLOAD_SLOT_HOUR, hour);
        p.put(CalendarSyncFeature.PAYLOAD_SLOT_MINUTES, min);
        return p;
    }

    private static CalendarBookingsClient.AvailableSlot slot(LocalDate date, int hour, int min, int capacity) {
        return new CalendarBookingsClient.AvailableSlot(date, hour, min, capacity);
    }

    // --- patch ---------------------------------------------------------------

    @Test
    void patchSuccessIsSucceeded() {
        FakeClient client = new FakeClient();
        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", patchPayload("ASSIGNED"));

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(1, client.patchCalls);
        assertEquals("ASSIGNED", client.lastPatchStatus);
    }

    // --- enrichment ----------------------------------------------------------

    /** An enriching binding: what the fetch resolved lands on the booking's data patch. */
    private static EventBindingFetchService enriching(Map<String, Object> values) {
        return new EventBindingFetchService(null, null, null, null) {
            @Override
            public Optional<FetchedValues> fetch(String tenantClientId, String eventType,
                    String scopeKind, String scopeKey, Map<String, Object> context) {
                assertEquals("tenant-1", tenantClientId);
                assertEquals(CalendarSyncFeature.EVENT_RESOURCE_ENRICHMENT, eventType);
                assertEquals(CalendarSyncFeature.SCOPE_CALENDAR, scopeKind);
                assertEquals(CAL.toString(), scopeKey);
                return Optional.of(new FetchedValues("b-1", "conn-1", values));
            }
        };
    }

    @Test
    void patchMergesEnrichedValuesOverThePayloadsOwnData() {
        FakeClient client = new FakeClient();
        Map<String, Object> payload = patchPayload("ASSIGNED");
        payload.put(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA,
                Map.of("origen", "SCL", "assignedDriver", "stale-uuid"));

        var result = new CalendarSyncExecutor(client,
                enriching(Map.of("assignedDriver", "fresh-uuid", "assignedTruck", "t-uuid")), CLOCK)
                .handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        // Payload data survives; freshly resolved values win on collision.
        assertEquals("SCL", client.lastPatchData.get("origen"));
        assertEquals("fresh-uuid", client.lastPatchData.get("assignedDriver"));
        assertEquals("t-uuid", client.lastPatchData.get("assignedTruck"));
        // What was resolved is surfaced for the job's result column.
        assertEquals(Map.of("assignedDriver", "fresh-uuid", "assignedTruck", "t-uuid"),
                result.result().get("enrichment"));
        assertEquals("b-1", result.result().get("bindingId"));
    }

    @Test
    void patchWithoutABindingIsUntouched() {
        FakeClient client = new FakeClient();
        Map<String, Object> payload = patchPayload("ASSIGNED");
        payload.put(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA, Map.of("origen", "SCL"));

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK)
                .handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(Map.of("origen", "SCL"), client.lastPatchData);
        assertNull(result.result());
    }

    @Test
    void aConfiguredFetchThatFailsFailsTheJob() {
        FakeClient client = new FakeClient();
        EventBindingFetchService failing = new EventBindingFetchService(null, null, null, null) {
            @Override
            public Optional<FetchedValues> fetch(String tenantClientId, String eventType,
                    String scopeKind, String scopeKey, Map<String, Object> context) {
                throw new IllegalStateException("partner down");
            }
        };

        // Fail closed: better a retried job than a booking written with silently missing data.
        assertThrows(IllegalStateException.class,
                () -> new CalendarSyncExecutor(client, failing, CLOCK)
                        .handle("tenant-1", patchPayload("ASSIGNED")));
        assertEquals(0, client.patchCalls);
    }

    /** The assign chain's PENDING stamp rides the patch payload untouched. */
    @Test
    void patchPassesSyncStatusThrough() {
        FakeClient client = new FakeClient();
        Map<String, Object> payload = patchPayload("ASSIGNED");
        payload.put(CalendarSyncFeature.PAYLOAD_SYNC_STATUS, "PENDING");

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals("PENDING", client.lastPatchSyncStatus);
    }

    @Test
    void patchWithoutSyncStatusSendsNone() {
        FakeClient client = new FakeClient();
        new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", patchPayload("ASSIGNED"));
        org.junit.jupiter.api.Assertions.assertNull(client.lastPatchSyncStatus);
    }

    @Test
    void patch404IsBenignSkip() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(404, "no booking");
        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", patchPayload("FINISHED"));
        assertEquals(JobOutcome.SKIPPED, result.outcome());
    }

    @Test
    void patch409IsBenignSkip() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(409, "regression");
        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", patchPayload("ARRIVED"));
        assertEquals(JobOutcome.SKIPPED, result.outcome());
    }

    @Test
    void patch500PropagatesForRetry() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(500, "boom");
        var executor = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK);
        var payload = patchPayload("FINISHED");
        assertThrows(CalendarBookingsHttpException.class, () -> executor.handle("tenant-1", payload));
    }

    // --- patch 404 materialization (create-then-apply) ------------------------

    /** Payload push data with the ISO ETD the producer writes on every push. */
    private static Map<String, Object> identityDataWithEtd(String etdIso) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("mintral_truckLicensePlate", "AB1234");
        data.put(CalendarSyncFeature.DATA_EXPECTED_DEPARTURE_DATE, etdIso);
        return data;
    }

    @Test
    void patch404WithEtdCreatesThenAppliesStatus() {
        FakeClient client = new FakeClient();
        client.patchThrowsOnce = new CalendarBookingsHttpException(404, "no booking");
        client.availableSlots = List.of(slot(LocalDate.of(2026, 7, 15), 14, 0, 1));
        Map<String, Object> payload = patchPayload("IN_TRANSIT");
        payload.put(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA,
                identityDataWithEtd("2026-07-15T10:00:00Z"));

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(1, client.createCalls, "the missing booking is created");
        assertEquals(LocalDate.of(2026, 7, 15), client.lastCreateDate);
        assertEquals(14, client.lastCreateHour);
        assertEquals(2, client.patchCalls, "the 404'd patch, then the post-create status apply");
        assertEquals("IN_TRANSIT", client.lastPatchStatus);
    }

    @Test
    void patch404PastEtdPicksSlotFromNow() {
        // ETD already behind the fixed clock (12:00Z) — the search window clamps to
        // now, so an in-flight service lands on the next slot with capacity.
        FakeClient client = new FakeClient();
        client.patchThrowsOnce = new CalendarBookingsHttpException(404, "no booking");
        client.availableSlots = List.of(
                slot(LocalDate.of(2026, 7, 15), 9, 0, 1),
                slot(LocalDate.of(2026, 7, 15), 16, 30, 1));
        Map<String, Object> payload = patchPayload("IN_TRANSIT");
        payload.put(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA,
                identityDataWithEtd("2026-07-14T08:00:00Z"));

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(16, client.lastCreateHour, "the 09:00 slot is already past — 16:30 wins");
        assertEquals(30, client.lastCreateMinutes);
    }

    @Test
    void patch404WithTerminalTargetStaysSkipped() {
        // FINISHED/CANCELLED on a missing booking is usually the cancel's own work
        // (future-slot cancels DELETE) — creating here would resurrect it.
        for (String terminal : List.of(CalendarSyncFeature.STATUS_FINISHED,
                CalendarSyncFeature.STATUS_CANCELLED)) {
            FakeClient client = new FakeClient();
            client.patchThrows = new CalendarBookingsHttpException(404, "no booking");
            Map<String, Object> payload = patchPayload(terminal);
            payload.put(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA,
                    identityDataWithEtd("2026-07-15T10:00:00Z"));

            var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

            assertEquals(JobOutcome.SKIPPED, result.outcome(), terminal + " must not create");
            assertEquals(0, client.createCalls, terminal + " must not create");
        }
    }

    @Test
    void patch404WithoutEtdStaysSkipped() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(404, "no booking");
        Map<String, Object> payload = patchPayload("IN_TRANSIT");
        payload.put(CalendarSyncFeature.PAYLOAD_RESOURCE_DATA,
                Map.of("mintral_truckLicensePlate", "AB1234"));

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SKIPPED, result.outcome());
        assertEquals(0, client.createCalls, "no ETD → nothing to place the booking at");
    }

    // --- unassign ------------------------------------------------------------

    @Test
    void unassignSuccessIsSucceededAndForwardsTheKeys() {
        FakeClient client = new FakeClient();
        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", unassignPayload(CLEAR_KEYS));

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(1, client.unassignCalls);
        assertEquals(CLEAR_KEYS, client.lastClearDataKeys);
    }

    /**
     * The forward {@code planService → assignDriver} path enqueues this op with
     * no booking yet to unassign.
     */
    @Test
    void unassign404IsBenignSkip() {
        FakeClient client = new FakeClient();
        client.unassignThrows = new CalendarBookingsHttpException(404, "no booking");
        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", unassignPayload(CLEAR_KEYS));
        assertEquals(JobOutcome.SKIPPED, result.outcome());
    }

    /**
     * Unlike a patch 409 — which means this job lost a race and a newer status
     * already won — an unassign 409 means the booking ran ahead of the
     * workflow. No retry converges, so it is terminal rather than a failure.
     */
    @Test
    void unassign409IsTerminalSkipNotRetried() {
        FakeClient client = new FakeClient();
        client.unassignThrows = new CalendarBookingsHttpException(409, "past ASSIGNED");
        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", unassignPayload(CLEAR_KEYS));

        assertEquals(JobOutcome.SKIPPED, result.outcome());
        assertTrue(result.detail().contains("past ASSIGNED"), result.detail());
    }

    @Test
    void unassign500PropagatesForRetry() {
        FakeClient client = new FakeClient();
        client.unassignThrows = new CalendarBookingsHttpException(500, "boom");
        var executor = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK);
        var payload = unassignPayload(CLEAR_KEYS);
        assertThrows(CalendarBookingsHttpException.class, () -> executor.handle("tenant-1", payload));
    }

    /** No keys is a valid job: reset the lifecycle, leave the payload alone. */
    @Test
    void unassignWithoutClearKeysStillRuns() {
        FakeClient client = new FakeClient();
        var payload = unassignPayload(null);
        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(List.of(), client.lastClearDataKeys);
    }

    /** Null and blank entries would silently target nothing — drop them. */
    @Test
    void unassignSkipsNullAndBlankKeys() {
        FakeClient client = new FakeClient();
        var keys = new ArrayList<String>();
        keys.add("assignedDriver");
        keys.add(null);
        keys.add("   ");
        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", unassignPayload(keys));

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(List.of("assignedDriver"), client.lastClearDataKeys);
    }

    // --- cancel --------------------------------------------------------------

    @Test
    void cancelNoBookingsIsSkipped() {
        FakeClient client = new FakeClient();
        client.listResult = List.of();
        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", cancelPayload());
        assertEquals(JobOutcome.SKIPPED, result.outcome());
    }

    @Test
    void cancelFutureSlotDeletesBooking() {
        FakeClient client = new FakeClient();
        var future = booking(LocalDate.of(2026, 7, 16));
        client.listResult = List.of(future);

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", cancelPayload());

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(List.of(future.id()), client.cancelled);
        assertEquals(0, client.patchCalls, "future slot deletes, never patches CANCELLED");
    }

    @Test
    void cancelPastSlotPatchesCancelled() {
        FakeClient client = new FakeClient();
        client.listResult = List.of(booking(LocalDate.of(2026, 7, 14)));

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", cancelPayload());

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertTrue(client.cancelled.isEmpty(), "past slot is kept for history, not deleted");
        assertEquals(CalendarSyncFeature.STATUS_CANCELLED, client.lastPatchStatus);
    }

    // --- ensure (Phase 2 upsert) ---------------------------------------------

    @Test
    void ensureAbsentWithExplicitSlotCreatesThenPatches() {
        FakeClient client = new FakeClient();
        client.listResult = List.of(); // no booking yet
        var payload = withExplicitSlot(ensurePayload("PLANNED"), LocalDate.of(2026, 7, 17), 14, 30);

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(1, client.createCalls);
        assertEquals(LocalDate.of(2026, 7, 17), client.lastCreateDate);
        assertEquals(14, client.lastCreateHour);
        assertEquals(30, client.lastCreateMinutes);
        assertEquals("PLANNED", client.lastPatchStatus, "stage status set after create");
        assertEquals(0, client.listAvailableCalls, "explicit slot needs no availability lookup");
    }

    @Test
    void ensureAbsentWithEtdAutoPicksEarliestAvailableSlot() {
        FakeClient client = new FakeClient();
        client.listResult = List.of();
        // window is [etd, etd+48h] = [2026-07-16T13:00, 2026-07-18T13:00]
        client.availableSlots = List.of(
                slot(LocalDate.of(2026, 7, 17), 8, 0, 2),
                slot(LocalDate.of(2026, 7, 16), 15, 0, 1)); // earliest in window
        var payload = ensurePayload("PLANNED");
        payload.put(CalendarSyncFeature.PAYLOAD_ETD, "2026-07-16T13:00:00");

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(1, client.createCalls);
        assertEquals(LocalDate.of(2026, 7, 16), client.lastCreateDate, "earliest available wins");
        assertEquals(15, client.lastCreateHour);
    }

    @Test
    void ensureAbsentWithEtdButNoCapacityThrowsForRetry() {
        FakeClient client = new FakeClient();
        client.listResult = List.of();
        client.availableSlots = List.of(); // capacity exhausted
        var payload = ensurePayload("PLANNED");
        payload.put(CalendarSyncFeature.PAYLOAD_ETD, "2026-07-16T13:00:00");
        var executor = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK);

        assertThrows(IllegalStateException.class, () -> executor.handle("tenant-1", payload));
        assertEquals(0, client.createCalls, "no slot → nothing created, job retries");
    }

    @Test
    void ensureAbsentWithNoSlotIntentIsSkipped() {
        FakeClient client = new FakeClient();
        client.listResult = List.of();
        // no explicit slot, no etd
        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", ensurePayload("PLANNED"));

        assertEquals(JobOutcome.SKIPPED, result.outcome());
        assertEquals(0, client.createCalls);
        assertEquals(0, client.listAvailableCalls);
    }

    @Test
    void ensureExistingWithDifferentExplicitSlotMovesThenPatches() {
        FakeClient client = new FakeClient();
        var existing = booking(LocalDate.of(2026, 7, 16)); // 09:00
        client.listResult = List.of(existing);
        var payload = withExplicitSlot(ensurePayload("ASSIGNED"), LocalDate.of(2026, 7, 17), 14, 30);

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(1, client.moveCalls);
        assertEquals(existing.id(), client.lastMoveBookingId);
        assertEquals(LocalDate.of(2026, 7, 17), client.lastMoveDate);
        assertEquals(0, client.createCalls, "existing booking is moved, never recreated");
        assertEquals("ASSIGNED", client.lastPatchStatus);
    }

    @Test
    void ensureExistingWithSameSlotDoesNotMove() {
        FakeClient client = new FakeClient();
        client.listResult = List.of(booking(LocalDate.of(2026, 7, 16))); // 09:00
        var payload = withExplicitSlot(ensurePayload("ASSIGNED"), LocalDate.of(2026, 7, 16), 9, 0);

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(0, client.moveCalls, "same slot → no move");
        assertEquals(1, client.patchCalls);
    }

    @Test
    void ensureExistingWithEtdOnlyDoesNotMove() {
        FakeClient client = new FakeClient();
        client.listResult = List.of(booking(LocalDate.of(2026, 7, 16)));
        var payload = ensurePayload("IN_TRANSIT");
        payload.put(CalendarSyncFeature.PAYLOAD_ETD, "2026-07-16T13:00:00");

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(0, client.moveCalls, "ETD auto-pick never re-slots an existing booking");
        assertEquals(0, client.listAvailableCalls);
        assertEquals("IN_TRANSIT", client.lastPatchStatus);
    }

    @Test
    void ensureExistingStatusRegressionIsBenign() {
        FakeClient client = new FakeClient();
        client.listResult = List.of(booking(LocalDate.of(2026, 7, 16)));
        client.patchThrows = new CalendarBookingsHttpException(409, "regression");
        var payload = withExplicitSlot(ensurePayload("PLANNED"), LocalDate.of(2026, 7, 16), 9, 0);

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome(), "409 on the status patch is benign");
    }

    @Test
    void ensureCreatePostStatus404Propagates() {
        FakeClient client = new FakeClient();
        client.listResult = List.of(); // absent → create path
        client.patchThrows = new CalendarBookingsHttpException(404, "not found after create");
        var payload = withExplicitSlot(ensurePayload("PLANNED"), LocalDate.of(2026, 7, 17), 14, 30);
        var executor = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK);

        // Create succeeds; a 404 on the POST-create status patch is an anomaly
        // (the booking exists) → propagate so a retry converges, not benign-skip.
        assertThrows(CalendarBookingsHttpException.class, () -> executor.handle("tenant-1", payload));
        assertEquals(1, client.createCalls, "the booking was created; the status patch is what failed");
    }

    @Test
    void ensureCreatePostStatus409IsBenign() {
        FakeClient client = new FakeClient();
        client.listResult = List.of();
        client.patchThrows = new CalendarBookingsHttpException(409, "already at/ahead");
        var payload = withExplicitSlot(ensurePayload("PLANNED"), LocalDate.of(2026, 7, 17), 14, 30);

        var result = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK).handle("tenant-1", payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome(), "409 on the post-create status patch is benign");
        assertEquals(1, client.createCalls);
    }

    /**
     * A move into an explicit slot the calendar rejects (409 — e.g. full capacity)
     * is terminal: retrying the same slot hits the same wall. It must surface as a
     * NonRetryableJobException so the worker parks it now instead of backing off
     * through the whole attempt budget.
     */
    @Test
    void ensureMoveToRejectedSlotIsNonRetryable() {
        FakeClient client = new FakeClient();
        client.listResult = List.of(booking(LocalDate.of(2026, 7, 16))); // existing at 09:00
        client.moveThrows = new CalendarBookingsHttpException(409, "Slot is at full capacity");
        var payload = withExplicitSlot(ensurePayload("ASSIGNED"), LocalDate.of(2026, 7, 17), 14, 30);
        var executor = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK);

        var e = assertThrows(NonRetryableJobException.class, () -> executor.handle("tenant-1", payload));
        assertTrue(e.getMessage().contains("full capacity"), e.getMessage());
        assertEquals(1, client.moveCalls);
        assertEquals(0, client.patchCalls, "a rejected move never reaches the status patch");
    }

    /** A create rejected by an explicit full slot (409, still no booking) is terminal. */
    @Test
    void ensureCreateIntoRejectedSlotIsNonRetryable() {
        FakeClient client = new FakeClient();
        client.listResult = List.of();            // absent → create path
        client.listResultAfterCreate = List.of(); // still absent after the 409 → capacity, not a race
        client.createThrows = new CalendarBookingsHttpException(409, "Slot is at full capacity");
        var payload = withExplicitSlot(ensurePayload("PLANNED"), LocalDate.of(2026, 7, 17), 14, 30);
        var executor = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK);

        var e = assertThrows(NonRetryableJobException.class, () -> executor.handle("tenant-1", payload));
        assertTrue(e.getMessage().contains("full capacity"), e.getMessage());
        assertEquals(1, client.createCalls);
    }

    /**
     * A create 409 where a sibling won the race (a booking now exists) stays
     * retryable — the re-run finds it via listByResource and converges through the
     * move path, so it must NOT be parked as non-retryable.
     */
    @Test
    void ensureCreate409WhenSiblingWonTheRaceStaysRetryable() {
        FakeClient client = new FakeClient();
        client.listResult = List.of(); // absent at first list → create path
        client.listResultAfterCreate = List.of(booking(LocalDate.of(2026, 7, 17))); // sibling created it
        client.createThrows = new CalendarBookingsHttpException(409, "already exists");
        var payload = withExplicitSlot(ensurePayload("PLANNED"), LocalDate.of(2026, 7, 17), 14, 30);
        var executor = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK);

        // Retryable (a plain CalendarBookingsHttpException, not NonRetryableJobException).
        assertThrows(CalendarBookingsHttpException.class, () -> executor.handle("tenant-1", payload));
    }

    @Test
    void ensureIncompleteExplicitSlotThrows() {
        FakeClient client = new FakeClient();
        client.listResult = List.of();
        var payload = ensurePayload("PLANNED");
        payload.put(CalendarSyncFeature.PAYLOAD_SLOT_DATE, "2026-07-17"); // date but no hour/minutes
        var executor = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK);

        // A partial explicit slot is malformed — reject it rather than silently
        // falling back to ETD auto-pick and booking an unintended slot.
        assertThrows(IllegalArgumentException.class, () -> executor.handle("tenant-1", payload));
        assertEquals(0, client.createCalls);
    }

    @Test
    void ensureWithoutCalendarIdThrows() {
        FakeClient client = new FakeClient();
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarSyncFeature.PAYLOAD_OP, CalendarSyncFeature.OP_ENSURE);
        p.put(CalendarSyncFeature.PAYLOAD_RESOURCE_ID, RESOURCE);
        p.put(CalendarSyncFeature.PAYLOAD_TARGET_STATUS, "PLANNED");
        var executor = new CalendarSyncExecutor(client, NO_ENRICHMENT, CLOCK);
        assertThrows(IllegalArgumentException.class, () -> executor.handle("tenant-1", p));
    }

    // --- validation ----------------------------------------------------------

    @Test
    void unknownOpThrows() {
        Map<String, Object> p = cancelPayload();
        p.put(CalendarSyncFeature.PAYLOAD_OP, "explode");
        var executor = new CalendarSyncExecutor(new FakeClient(), NO_ENRICHMENT, CLOCK);
        assertThrows(IllegalArgumentException.class, () -> executor.handle("tenant-1", p));
    }

    @Test
    void missingResourceIdThrows() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarSyncFeature.PAYLOAD_OP, CalendarSyncFeature.OP_PATCH);
        var executor = new CalendarSyncExecutor(new FakeClient(), NO_ENRICHMENT, CLOCK);
        assertThrows(IllegalArgumentException.class, () -> executor.handle("tenant-1", p));
    }

    /** Records calls and lets each network method be primed to throw. */
    private static final class FakeClient extends CalendarBookingsClient {
        List<CalendarBookingsClient.BookingView> listResult = List.of();
        List<CalendarBookingsClient.AvailableSlot> availableSlots = List.of();
        RuntimeException patchThrows;
        // Thrown by the FIRST patch only — models a 404 whose follow-up
        // (the post-create status apply) must succeed.
        RuntimeException patchThrowsOnce;
        int patchCalls;
        String lastPatchStatus;
        Map<String, Object> lastPatchData;
        String lastPatchSyncStatus;
        final List<UUID> cancelled = new ArrayList<>();

        final UUID createdId = UUID.fromString("00000000-0000-0000-0000-0000000000c1");
        int createCalls;
        LocalDate lastCreateDate;
        int lastCreateHour;
        int lastCreateMinutes;
        int listAvailableCalls;

        RuntimeException unassignThrows;
        int unassignCalls;
        List<String> lastClearDataKeys;

        int moveCalls;
        UUID lastMoveBookingId;
        LocalDate lastMoveDate;
        int lastMoveHour;
        int lastMoveMinutes;
        RuntimeException moveThrows;
        RuntimeException createThrows;
        // What listByResource returns after the first call — lets a test model a
        // create-409 race (a sibling booking appears) vs a capacity 409 (stays empty).
        List<CalendarBookingsClient.BookingView> listResultAfterCreate;
        int listCalls;

        @Override
        public boolean isConfigured() {
            return true;
        }

        @Override
        public void patchByResource(String resourceId, UUID calendarId, String targetStatus,
                                    Map<String, Object> resourceDataPatch,
                                    String syncStatus, String syncDetail) {
            patchCalls++;
            lastPatchStatus = targetStatus;
            lastPatchData = resourceDataPatch;
            lastPatchSyncStatus = syncStatus;
            if (patchThrowsOnce != null) {
                RuntimeException once = patchThrowsOnce;
                patchThrowsOnce = null;
                throw once;
            }
            if (patchThrows != null) {
                throw patchThrows;
            }
        }

        @Override
        public List<CalendarBookingsClient.BookingView> listByResource(String resourceId, UUID calendarId) {
            listCalls++;
            if (listCalls > 1 && listResultAfterCreate != null) {
                return listResultAfterCreate;
            }
            return listResult;
        }

        @Override
        public void cancel(UUID bookingId) {
            cancelled.add(bookingId);
        }

        @Override
        public UUID create(UUID calendarId, LocalDate slotDate, int slotHour, int slotMinutes,
                           String resourceId, String resourceType, Map<String, Object> resourceData) {
            createCalls++;
            lastCreateDate = slotDate;
            lastCreateHour = slotHour;
            lastCreateMinutes = slotMinutes;
            if (createThrows != null) {
                throw createThrows;
            }
            return createdId;
        }

        @Override
        public void move(UUID bookingId, LocalDate slotDate, int slotHour, int slotMinutes) {
            moveCalls++;
            lastMoveBookingId = bookingId;
            lastMoveDate = slotDate;
            lastMoveHour = slotHour;
            lastMoveMinutes = slotMinutes;
            if (moveThrows != null) {
                throw moveThrows;
            }
        }

        @Override
        public List<CalendarBookingsClient.AvailableSlot> listAvailableSlots(
                UUID calendarId, LocalDate startDate, LocalDate endDate) {
            listAvailableCalls++;
            return availableSlots;
        }

        @Override
        public void unassignByResource(String resourceId, UUID calendarId, List<String> clearDataKeys) {
            unassignCalls++;
            lastClearDataKeys = clearDataKeys;
            if (unassignThrows != null) {
                throw unassignThrows;
            }
        }
    }
}

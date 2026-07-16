package com.microboxlabs.miot.integrations.calendar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

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

    private static Map<String, Object> patchPayload(String status) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarSyncFeature.PAYLOAD_OP, CalendarSyncFeature.OP_PATCH);
        p.put(CalendarSyncFeature.PAYLOAD_RESOURCE_ID, RESOURCE);
        p.put(CalendarSyncFeature.PAYLOAD_CALENDAR_ID, CAL.toString());
        p.put(CalendarSyncFeature.PAYLOAD_TARGET_STATUS, status);
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
        var result = new CalendarSyncExecutor(client, CLOCK).handle(patchPayload("ASSIGNED"));

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(1, client.patchCalls);
        assertEquals("ASSIGNED", client.lastPatchStatus);
    }

    @Test
    void patch404IsBenignSkip() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(404, "no booking");
        var result = new CalendarSyncExecutor(client, CLOCK).handle(patchPayload("FINISHED"));
        assertEquals(JobOutcome.SKIPPED, result.outcome());
    }

    @Test
    void patch409IsBenignSkip() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(409, "regression");
        var result = new CalendarSyncExecutor(client, CLOCK).handle(patchPayload("ARRIVED"));
        assertEquals(JobOutcome.SKIPPED, result.outcome());
    }

    @Test
    void patch500PropagatesForRetry() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(500, "boom");
        var executor = new CalendarSyncExecutor(client, CLOCK);
        var payload = patchPayload("FINISHED");
        assertThrows(CalendarBookingsHttpException.class, () -> executor.handle(payload));
    }

    // --- cancel --------------------------------------------------------------

    @Test
    void cancelNoBookingsIsSkipped() {
        FakeClient client = new FakeClient();
        client.listResult = List.of();
        var result = new CalendarSyncExecutor(client, CLOCK).handle(cancelPayload());
        assertEquals(JobOutcome.SKIPPED, result.outcome());
    }

    @Test
    void cancelFutureSlotDeletesBooking() {
        FakeClient client = new FakeClient();
        var future = booking(LocalDate.of(2026, 7, 16));
        client.listResult = List.of(future);

        var result = new CalendarSyncExecutor(client, CLOCK).handle(cancelPayload());

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(List.of(future.id()), client.cancelled);
        assertEquals(0, client.patchCalls, "future slot deletes, never patches CANCELLED");
    }

    @Test
    void cancelPastSlotPatchesCancelled() {
        FakeClient client = new FakeClient();
        client.listResult = List.of(booking(LocalDate.of(2026, 7, 14)));

        var result = new CalendarSyncExecutor(client, CLOCK).handle(cancelPayload());

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

        var result = new CalendarSyncExecutor(client, CLOCK).handle(payload);

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

        var result = new CalendarSyncExecutor(client, CLOCK).handle(payload);

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
        var executor = new CalendarSyncExecutor(client, CLOCK);

        assertThrows(IllegalStateException.class, () -> executor.handle(payload));
        assertEquals(0, client.createCalls, "no slot → nothing created, job retries");
    }

    @Test
    void ensureAbsentWithNoSlotIntentIsSkipped() {
        FakeClient client = new FakeClient();
        client.listResult = List.of();
        // no explicit slot, no etd
        var result = new CalendarSyncExecutor(client, CLOCK).handle(ensurePayload("PLANNED"));

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

        var result = new CalendarSyncExecutor(client, CLOCK).handle(payload);

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

        var result = new CalendarSyncExecutor(client, CLOCK).handle(payload);

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

        var result = new CalendarSyncExecutor(client, CLOCK).handle(payload);

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

        var result = new CalendarSyncExecutor(client, CLOCK).handle(payload);

        assertEquals(JobOutcome.SUCCEEDED, result.outcome(), "409 on the status patch is benign");
    }

    @Test
    void ensureWithoutCalendarIdThrows() {
        FakeClient client = new FakeClient();
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarSyncFeature.PAYLOAD_OP, CalendarSyncFeature.OP_ENSURE);
        p.put(CalendarSyncFeature.PAYLOAD_RESOURCE_ID, RESOURCE);
        p.put(CalendarSyncFeature.PAYLOAD_TARGET_STATUS, "PLANNED");
        var executor = new CalendarSyncExecutor(client, CLOCK);
        assertThrows(IllegalArgumentException.class, () -> executor.handle(p));
    }

    // --- validation ----------------------------------------------------------

    @Test
    void unknownOpThrows() {
        Map<String, Object> p = cancelPayload();
        p.put(CalendarSyncFeature.PAYLOAD_OP, "explode");
        var executor = new CalendarSyncExecutor(new FakeClient(), CLOCK);
        assertThrows(IllegalArgumentException.class, () -> executor.handle(p));
    }

    @Test
    void missingResourceIdThrows() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarSyncFeature.PAYLOAD_OP, CalendarSyncFeature.OP_PATCH);
        var executor = new CalendarSyncExecutor(new FakeClient(), CLOCK);
        assertThrows(IllegalArgumentException.class, () -> executor.handle(p));
    }

    /** Records calls and lets each network method be primed to throw. */
    private static final class FakeClient extends CalendarBookingsClient {
        List<CalendarBookingsClient.BookingView> listResult = List.of();
        List<CalendarBookingsClient.AvailableSlot> availableSlots = List.of();
        RuntimeException patchThrows;
        int patchCalls;
        String lastPatchStatus;
        final List<UUID> cancelled = new ArrayList<>();

        final UUID createdId = UUID.fromString("00000000-0000-0000-0000-0000000000c1");
        int createCalls;
        LocalDate lastCreateDate;
        int lastCreateHour;
        int lastCreateMinutes;
        int listAvailableCalls;

        int moveCalls;
        UUID lastMoveBookingId;
        LocalDate lastMoveDate;
        int lastMoveHour;
        int lastMoveMinutes;

        @Override
        public boolean isConfigured() {
            return true;
        }

        @Override
        public void patchByResource(String resourceId, UUID calendarId, String targetStatus,
                                    Map<String, Object> resourceDataPatch) {
            patchCalls++;
            lastPatchStatus = targetStatus;
            if (patchThrows != null) {
                throw patchThrows;
            }
        }

        @Override
        public List<CalendarBookingsClient.BookingView> listByResource(String resourceId, UUID calendarId) {
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
            return createdId;
        }

        @Override
        public void move(UUID bookingId, LocalDate slotDate, int slotHour, int slotMinutes) {
            moveCalls++;
            lastMoveBookingId = bookingId;
            lastMoveDate = slotDate;
            lastMoveHour = slotHour;
            lastMoveMinutes = slotMinutes;
        }

        @Override
        public List<CalendarBookingsClient.AvailableSlot> listAvailableSlots(
                UUID calendarId, LocalDate startDate, LocalDate endDate) {
            listAvailableCalls++;
            return availableSlots;
        }
    }
}

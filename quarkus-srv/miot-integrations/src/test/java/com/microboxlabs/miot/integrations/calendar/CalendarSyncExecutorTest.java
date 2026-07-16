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
        RuntimeException patchThrows;
        int patchCalls;
        String lastPatchStatus;
        final List<UUID> cancelled = new ArrayList<>();

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
    }
}

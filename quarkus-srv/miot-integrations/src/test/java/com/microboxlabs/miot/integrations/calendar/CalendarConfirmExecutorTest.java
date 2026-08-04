package com.microboxlabs.miot.integrations.calendar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Outcome policy for the calendar_confirm leg: stamp CONFIRMED on success,
 * benign-skip a vanished booking (404), propagate everything else for retry.
 * The chain-ordering guarantees (runs only after the dispatch leg SUCCEEDED)
 * live in the ledger's claim SQL, not here.
 */
class CalendarConfirmExecutorTest {

    private static final UUID CAL = UUID.fromString("3b4808f2-68ae-4b45-b921-f5a012a8962a");
    private static final String RESOURCE = "1658427-V";

    private static Map<String, Object> payload() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarConfirmFeature.PAYLOAD_SERVICE_CODE, "1658427");
        p.put(CalendarConfirmFeature.PAYLOAD_CALENDAR_ID, CAL.toString());
        p.put(CalendarConfirmFeature.PAYLOAD_RESOURCE_ID, RESOURCE);
        return p;
    }

    @Test
    void confirmStampsSyncStatusOnly() {
        FakeClient client = new FakeClient();
        var result = new CalendarConfirmExecutor(client).handle("tenant-1", payload());

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(1, client.patchCalls);
        assertEquals("CONFIRMED", client.lastSyncStatus);
        // The lifecycle status must NOT be touched — confirmation is the
        // orthogonal dimension; sending a status here could 409 or regress.
        assertNull(client.lastStatus);
        assertEquals(RESOURCE, client.lastResourceId);
        assertEquals(CAL, client.lastCalendarId);
    }

    /**
     * The detail text is the enqueuer's: only it knows whether an assignment
     * tuple or an unassignment's stand-in values were confirmed, and the
     * partner's name is operator vocabulary this executor must not hardcode.
     */
    @Test
    void confirmWritesThePayloadSyncDetail() {
        FakeClient client = new FakeClient();
        var p = payload();
        p.put(CalendarConfirmFeature.PAYLOAD_SYNC_DETAIL, "TMS accepted the stand-in values");

        new CalendarConfirmExecutor(client).handle("tenant-1", p);

        assertEquals("TMS accepted the stand-in values", client.lastSyncDetail);
    }

    /** Blank producer detail falls back to a generic, partner-neutral value. */
    @Test
    void confirmFallsBackToGenericSyncDetail() {
        FakeClient client = new FakeClient();
        var p = payload();
        p.put(CalendarConfirmFeature.PAYLOAD_SYNC_DETAIL, "   ");

        new CalendarConfirmExecutor(client).handle("tenant-1", p);

        assertEquals(CalendarConfirmFeature.DEFAULT_SYNC_DETAIL, client.lastSyncDetail);
    }

    @Test
    void vanishedBookingIsBenignSkip() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(404, "no booking");

        var result = new CalendarConfirmExecutor(client).handle("tenant-1", payload());

        assertEquals(JobOutcome.SKIPPED, result.outcome());
    }

    @Test
    void transportErrorPropagatesForRetry() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(-1, "io error");
        var executor = new CalendarConfirmExecutor(client);
        var p = payload();
        assertThrows(CalendarBookingsHttpException.class, () -> executor.handle("tenant-1", p));
    }

    @Test
    void missingResourceIdThrows() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarConfirmFeature.PAYLOAD_SERVICE_CODE, "1658427");
        var executor = new CalendarConfirmExecutor(new FakeClient());
        assertThrows(IllegalArgumentException.class, () -> executor.handle("tenant-1", p));
    }

    private static final class FakeClient extends CalendarBookingsClient {
        RuntimeException patchThrows;
        int patchCalls;
        String lastResourceId;
        UUID lastCalendarId;
        String lastStatus;
        String lastSyncStatus;
        String lastSyncDetail;

        @Override
        public boolean isConfigured() {
            return true;
        }

        @Override
        public void patchByResource(String resourceId, UUID calendarId, String targetStatus,
                                    Map<String, Object> resourceDataPatch,
                                    String syncStatus, String syncDetail) {
            patchCalls++;
            lastResourceId = resourceId;
            lastCalendarId = calendarId;
            lastStatus = targetStatus;
            lastSyncStatus = syncStatus;
            lastSyncDetail = syncDetail;
            if (patchThrows != null) {
                throw patchThrows;
            }
        }
    }
}

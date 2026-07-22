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
 * The chain-ordering guarantees (runs only after alerce_assignment SUCCEEDED)
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
        var result = new CalendarConfirmExecutor(client).handle(payload());

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(1, client.patchCalls);
        assertEquals("CONFIRMED", client.lastSyncStatus);
        // The lifecycle status must NOT be touched — confirmation is the
        // orthogonal dimension; sending a status here could 409 or regress.
        assertNull(client.lastStatus);
        assertEquals(RESOURCE, client.lastResourceId);
        assertEquals(CAL, client.lastCalendarId);
    }

    @Test
    void vanishedBookingIsBenignSkip() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(404, "no booking");

        var result = new CalendarConfirmExecutor(client).handle(payload());

        assertEquals(JobOutcome.SKIPPED, result.outcome());
    }

    @Test
    void transportErrorPropagatesForRetry() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(-1, "io error");
        var executor = new CalendarConfirmExecutor(client);
        var p = payload();
        assertThrows(CalendarBookingsHttpException.class, () -> executor.handle(p));
    }

    @Test
    void missingResourceIdThrows() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarConfirmFeature.PAYLOAD_SERVICE_CODE, "1658427");
        var executor = new CalendarConfirmExecutor(new FakeClient());
        assertThrows(IllegalArgumentException.class, () -> executor.handle(p));
    }

    private static final class FakeClient extends CalendarBookingsClient {
        RuntimeException patchThrows;
        int patchCalls;
        String lastResourceId;
        UUID lastCalendarId;
        String lastStatus;
        String lastSyncStatus;

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
            if (patchThrows != null) {
                throw patchThrows;
            }
        }
    }
}

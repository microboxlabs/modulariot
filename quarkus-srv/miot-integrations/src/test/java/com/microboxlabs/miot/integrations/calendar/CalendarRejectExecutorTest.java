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
 * Outcome policy for the calendar_reject stamp: REJECTED plus the failure
 * detail on success, benign-skip a vanished booking (404), propagate everything
 * else for retry. The decision of WHEN to stamp lives in
 * {@link CalendarRejectOnPark}, not here.
 */
class CalendarRejectExecutorTest {

    private static final UUID CAL = UUID.fromString("3b4808f2-68ae-4b45-b921-f5a012a8962a");
    private static final String RESOURCE = "1658427-V";
    private static final String ERROR = "Alerce rejected the push: CONDUCTOR2 NO EXISTE";

    private static Map<String, Object> payload() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarRejectFeature.PAYLOAD_SERVICE_CODE, "1658427");
        p.put(CalendarRejectFeature.PAYLOAD_CALENDAR_ID, CAL.toString());
        p.put(CalendarRejectFeature.PAYLOAD_RESOURCE_ID, RESOURCE);
        p.put(CalendarRejectFeature.PAYLOAD_DETAIL, ERROR);
        return p;
    }

    @Test
    void rejectStampsSyncStatusWithDetailOnly() {
        FakeClient client = new FakeClient();
        var result = new CalendarRejectExecutor(client).handle(payload());

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(1, client.patchCalls);
        assertEquals("REJECTED", client.lastSyncStatus);
        assertEquals(ERROR, client.lastSyncDetail);
        // The lifecycle status must NOT be touched — rejection is the
        // orthogonal acknowledgement dimension.
        assertNull(client.lastStatus);
        assertEquals(RESOURCE, client.lastResourceId);
        assertEquals(CAL, client.lastCalendarId);
    }

    @Test
    void oversizedDetailIsTruncatedToTheColumnBudget() {
        FakeClient client = new FakeClient();
        Map<String, Object> p = payload();
        p.put(CalendarRejectFeature.PAYLOAD_DETAIL, "x".repeat(700));

        new CalendarRejectExecutor(client).handle(p);

        assertEquals(CalendarRejectFeature.DETAIL_MAX_LENGTH, client.lastSyncDetail.length());
    }

    @Test
    void missingDetailFallsBackToAGenericOne() {
        FakeClient client = new FakeClient();
        Map<String, Object> p = payload();
        p.remove(CalendarRejectFeature.PAYLOAD_DETAIL);

        new CalendarRejectExecutor(client).handle(p);

        assertEquals("The external push failed", client.lastSyncDetail);
    }

    @Test
    void vanishedBookingIsBenignSkip() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(404, "no booking");

        var result = new CalendarRejectExecutor(client).handle(payload());

        assertEquals(JobOutcome.SKIPPED, result.outcome());
    }

    @Test
    void transportErrorPropagatesForRetry() {
        FakeClient client = new FakeClient();
        client.patchThrows = new CalendarBookingsHttpException(-1, "io error");
        var executor = new CalendarRejectExecutor(client);
        var p = payload();
        assertThrows(CalendarBookingsHttpException.class, () -> executor.handle(p));
    }

    @Test
    void missingResourceIdThrows() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(CalendarRejectFeature.PAYLOAD_SERVICE_CODE, "1658427");
        var executor = new CalendarRejectExecutor(new FakeClient());
        assertThrows(IllegalArgumentException.class, () -> executor.handle(p));
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

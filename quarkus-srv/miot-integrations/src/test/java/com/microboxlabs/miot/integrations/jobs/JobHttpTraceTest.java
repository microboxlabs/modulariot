package com.microboxlabs.miot.integrations.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class JobHttpTraceTest {

    /** No test may leak a window into the next one — the thread is reused. */
    @AfterEach
    void closeAnyOpenWindow() {
        JobHttpTrace.end();
    }

    @Test
    void recordsTheExchangeInsideAWindow() {
        JobHttpTrace.begin();
        JobHttpTrace.record("PATCH", "http://calendar/bookings/resource/1658427", 409, 42,
                "{\"status\":\"ASSIGNED\"}", "{\"error\":\"status regression\"}", null);

        List<Map<String, Object>> exchanges = JobHttpTrace.end();

        assertEquals(1, exchanges.size());
        Map<String, Object> entry = exchanges.get(0);
        assertEquals("PATCH", entry.get("method"));
        assertEquals("http://calendar/bookings/resource/1658427", entry.get("url"));
        assertEquals(409, entry.get("status"));
        assertEquals(42L, entry.get("durationMs"));
        assertEquals("{\"status\":\"ASSIGNED\"}", entry.get("requestBody"));
        assertEquals("{\"error\":\"status regression\"}", entry.get("responseBody"));
        assertNotNullAt(entry);
    }

    @Test
    void recordsATransportFailureWithNoStatus() {
        JobHttpTrace.begin();
        JobHttpTrace.record("POST", "http://calendar/bookings", null, 5000, "{}", null, "io error: timeout");

        Map<String, Object> entry = JobHttpTrace.end().get(0);
        assertNull(entry.get("status"), "a call that never got a response has no status");
        assertEquals("io error: timeout", entry.get("error"));
    }

    @Test
    void recordingOutsideAWindowIsANoOp() {
        // The client is shared with non-job traffic; recording must not accumulate
        // anywhere when nobody opened a window.
        JobHttpTrace.record("GET", "http://calendar/slots", 200, 1, null, "[]", null);
        assertTrue(JobHttpTrace.end().isEmpty());
    }

    @Test
    void endIsIdempotentAndClosesTheWindow() {
        JobHttpTrace.begin();
        JobHttpTrace.record("GET", "http://calendar/slots", 200, 1, null, "[]", null);
        assertEquals(1, JobHttpTrace.end().size());
        assertTrue(JobHttpTrace.end().isEmpty(), "a second end sees a closed window");

        // And a call after closing does not resurrect it.
        JobHttpTrace.record("GET", "http://calendar/slots", 200, 1, null, "[]", null);
        assertTrue(JobHttpTrace.end().isEmpty());
    }

    @Test
    void beginDiscardsAStaleWindow() {
        JobHttpTrace.begin();
        JobHttpTrace.record("GET", "http://calendar/a", 200, 1, null, "a", null);
        JobHttpTrace.begin();
        JobHttpTrace.record("GET", "http://calendar/b", 200, 1, null, "b", null);

        List<Map<String, Object>> exchanges = JobHttpTrace.end();
        assertEquals(1, exchanges.size(), "the new window starts empty");
        assertEquals("http://calendar/b", exchanges.get(0).get("url"));
    }

    @Test
    void truncatesAnOversizedBodyAndSaysSo() {
        JobHttpTrace.begin();
        String huge = "x".repeat(JobHttpTrace.MAX_BODY_CHARS + 500);
        JobHttpTrace.record("POST", "http://calendar/bookings", 200, 1, huge, huge, null);

        String recorded = (String) JobHttpTrace.end().get(0).get("responseBody");
        assertTrue(recorded.length() < huge.length());
        assertTrue(recorded.startsWith("x".repeat(JobHttpTrace.MAX_BODY_CHARS)));
        assertTrue(recorded.contains("500 more chars"), "truncation announces itself: " + recorded);
    }

    @Test
    void capsTheExchangeCountAndRecordsTheOverflow() {
        JobHttpTrace.begin();
        int over = 3;
        for (int i = 0; i < JobHttpTrace.MAX_EXCHANGES + over; i++) {
            JobHttpTrace.record("GET", "http://calendar/slots?page=" + i, 200, 1, null, "[]", null);
        }

        List<Map<String, Object>> exchanges = JobHttpTrace.end();
        assertEquals(JobHttpTrace.MAX_EXCHANGES + 1, exchanges.size(), "capped, plus one overflow marker");
        Map<String, Object> marker = exchanges.get(exchanges.size() - 1);
        assertEquals(over + " further exchange(s) not recorded (cap " + JobHttpTrace.MAX_EXCHANGES + ")",
                marker.get("note"), "the cap is never silent");
    }

    @Test
    void sanitizeReappliesTheCapsToAForeignReport() {
        List<Map<String, Object>> reported = new ArrayList<>();
        int over = 5;
        for (int i = 0; i < JobHttpTrace.MAX_EXCHANGES + over; i++) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("url", "http://alerce/svc/" + i);
            entry.put("responseBody", "y".repeat(JobHttpTrace.MAX_BODY_CHARS + 10));
            entry.put("status", 200);
            reported.add(entry);
        }

        List<Map<String, Object>> sanitized = JobHttpTrace.sanitize(reported);

        assertEquals(JobHttpTrace.MAX_EXCHANGES + 1, sanitized.size());
        assertTrue(((String) sanitized.get(0).get("responseBody")).contains("10 more chars"),
                "an oversized body from another process is truncated here too");
        assertEquals(200, sanitized.get(0).get("status"), "non-string values pass through untouched");
        assertTrue(sanitized.get(sanitized.size() - 1).containsKey("note"));
    }

    @Test
    void sanitizeToleratesNullEmptyAndNullEntries() {
        assertTrue(JobHttpTrace.sanitize(null).isEmpty());
        assertTrue(JobHttpTrace.sanitize(List.of()).isEmpty());

        List<Map<String, Object>> withNull = new ArrayList<>();
        withNull.add(null);
        withNull.add(Map.of("url", "http://alerce/svc"));
        List<Map<String, Object>> sanitized = JobHttpTrace.sanitize(withNull);
        assertEquals(1, sanitized.size());
        assertFalse(sanitized.get(0).isEmpty());
    }

    private static void assertNotNullAt(Map<String, Object> entry) {
        assertTrue(entry.get("at") instanceof String at && !at.isBlank(), "every exchange is stamped");
    }
}

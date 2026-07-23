package com.microboxlabs.miot.integrations.jobs;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Records the HTTP exchanges an async job made, so the console can show what
 * actually went over the wire instead of only the request payload.
 *
 * <p>The ledger stored the job's <b>payload</b> and a one-line {@code detail}
 * per attempt, which is enough to know that a push failed but not <i>why</i>:
 * the downstream's status code and response body — the part that carries the
 * real reason ("REMOLQUE NO EXISTE", a 409 regression, a validation list) —
 * were lost the moment the handler returned. Each attempt now carries the whole
 * exchange list under {@code attempt_history[].http}.
 *
 * <p><b>Scope is one attempt on one thread.</b> {@link ModulithJobWorker} runs
 * jobs one at a time and opens a recording window around
 * {@link ModulithJobHandler#handle}, so a thread-local needs no correlation and
 * cannot mix two jobs. Outside a window every {@link #record} call is a no-op,
 * which is what makes it safe to call unconditionally from a shared HTTP client
 * that also serves non-job traffic.
 *
 * <p><b>What is deliberately not recorded: headers.</b> That is where the
 * bearer tokens live, and this data is rendered in a browser console and kept
 * as long as the job row. Bodies are capped at {@link #MAX_BODY_CHARS} and the
 * list at {@link #MAX_EXCHANGES} so one chatty job cannot bloat the row; both
 * caps announce themselves in the recorded data rather than truncating
 * silently.
 */
public final class JobHttpTrace {

    /** Per-attempt exchange cap. Beyond this a marker entry records the overflow. */
    public static final int MAX_EXCHANGES = 20;
    /** Per-body character cap, applied to request and response alike. */
    public static final int MAX_BODY_CHARS = 4000;

    private static final ThreadLocal<Recording> ACTIVE = new ThreadLocal<>();

    private JobHttpTrace() {
    }

    /** Opens a recording window on this thread, discarding any stale one. */
    public static void begin() {
        ACTIVE.set(new Recording());
    }

    /**
     * Closes the window and returns what was recorded (never null). Always call
     * this in a {@code finally} — a leaked thread-local would attribute the next
     * job's calls to this one.
     */
    public static List<Map<String, Object>> end() {
        Recording recording = ACTIVE.get();
        ACTIVE.remove();
        return recording == null ? List.of() : recording.drain();
    }

    /**
     * Records one exchange. A no-op outside a recording window, and never throws
     * — tracing must not be able to fail the job it is observing.
     *
     * @param status the HTTP status, or null when the call never got one (a
     *        timeout, a DNS failure, a dropped connection)
     * @param error the transport failure message, or null on a completed call
     */
    public static void record(String method, String url, Integer status, long durationMs,
                              String requestBody, String responseBody, String error) {
        Recording recording = ACTIVE.get();
        if (recording == null) {
            return;
        }
        try {
            recording.add(method, url, status, durationMs, requestBody, responseBody, error);
        } catch (RuntimeException e) {
            // Deliberately swallowed: a broken trace is never worth failing a
            // delivery over. The exchange is simply missing from the timeline.
            recording.dropped++;
        }
    }

    /**
     * Normalizes an exchange list that arrived from outside this JVM (an
     * {@code ecm}-lane worker reporting over REST). The caps are ours to
     * enforce, not the reporter's, so they are re-applied here.
     */
    public static List<Map<String, Object>> sanitize(List<Map<String, Object>> exchanges) {
        if (exchanges == null || exchanges.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>(Math.min(exchanges.size(), MAX_EXCHANGES));
        for (Map<String, Object> exchange : exchanges) {
            if (exchange == null) {
                continue;
            }
            if (out.size() == MAX_EXCHANGES) {
                out.add(overflow(exchanges.size() - MAX_EXCHANGES));
                break;
            }
            out.add(truncateValues(exchange));
        }
        return out;
    }

    private static Map<String, Object> truncateValues(Map<String, Object> exchange) {
        Map<String, Object> copy = new LinkedHashMap<>();
        exchange.forEach((key, value) ->
                copy.put(key, value instanceof String text ? truncate(text) : value));
        return copy;
    }

    private static Map<String, Object> overflow(int dropped) {
        Map<String, Object> marker = new LinkedHashMap<>();
        marker.put("note", dropped + " further exchange(s) not recorded (cap " + MAX_EXCHANGES + ")");
        return marker;
    }

    private static String truncate(String body) {
        if (body == null || body.length() <= MAX_BODY_CHARS) {
            return body;
        }
        return body.substring(0, MAX_BODY_CHARS) + "… [" + (body.length() - MAX_BODY_CHARS) + " more chars]";
    }

    /** One attempt's worth of exchanges, plus what the cap turned away. */
    private static final class Recording {

        private final List<Map<String, Object>> exchanges = new ArrayList<>();
        private int dropped;

        void add(String method, String url, Integer status, long durationMs,
                 String requestBody, String responseBody, String error) {
            if (exchanges.size() >= MAX_EXCHANGES) {
                dropped++;
                return;
            }
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("at", OffsetDateTime.now(ZoneOffset.UTC).toString());
            entry.put("method", method);
            entry.put("url", url);
            if (status != null) {
                entry.put("status", status);
            }
            entry.put("durationMs", durationMs);
            if (requestBody != null && !requestBody.isBlank()) {
                entry.put("requestBody", truncate(requestBody));
            }
            if (responseBody != null && !responseBody.isBlank()) {
                entry.put("responseBody", truncate(responseBody));
            }
            if (error != null) {
                entry.put("error", error);
            }
            exchanges.add(entry);
        }

        List<Map<String, Object>> drain() {
            if (dropped > 0) {
                exchanges.add(overflow(dropped));
            }
            return List.copyOf(exchanges);
        }
    }
}

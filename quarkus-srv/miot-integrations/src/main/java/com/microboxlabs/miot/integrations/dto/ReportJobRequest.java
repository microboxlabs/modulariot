package com.microboxlabs.miot.integrations.dto;

import java.util.List;
import java.util.Map;

/**
 * Worker outcome report. {@code outcome} is SUCCEEDED, SKIPPED (nothing to do —
 * recorded as SUCCEEDED with detail) or FAILED. {@code retryable=false} parks a
 * FAILED job immediately regardless of remaining attempts. {@code attempts}
 * echoes the attempt number the worker observed at claim time and is used as a
 * compare-and-set guard so stale reports (expired lease, job reclaimed) are
 * rejected.
 *
 * <p>{@code exchanges} is the attempt's HTTP timeline — what the worker sent
 * downstream and what came back — stored under {@code attempt_history[].http}
 * and rendered by the job console. Optional and additive: a worker that does
 * not send it (an {@code ecm}-lane worker that has not adopted tracing yet, or
 * a job that makes no HTTP call) reports exactly as before. See
 * {@link com.microboxlabs.miot.integrations.jobs.JobHttpTrace} for the entry
 * shape and the caps re-applied on arrival.
 */
public record ReportJobRequest(
        String workerId,
        String outcome,
        String detail,
        Boolean retryable,
        Integer attempts,
        List<Map<String, Object>> exchanges,
        /** What the run produced (e.g. resolved ids), stored on the job; null keeps the prior value. */
        Map<String, Object> result) {

    /** Report with no HTTP timeline — the shape every caller used before tracing. */
    public ReportJobRequest(String workerId, String outcome, String detail, Boolean retryable, Integer attempts) {
        this(workerId, outcome, detail, retryable, attempts, null, null);
    }

    /** Report with a timeline but no result — the pre-result shape. */
    public ReportJobRequest(String workerId, String outcome, String detail, Boolean retryable, Integer attempts,
            List<Map<String, Object>> exchanges) {
        this(workerId, outcome, detail, retryable, attempts, exchanges, null);
    }
}

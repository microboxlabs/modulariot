package com.microboxlabs.miot.integrations.dto;

/**
 * Worker outcome report. {@code outcome} is SUCCEEDED, SKIPPED (nothing to do —
 * recorded as SUCCEEDED with detail) or FAILED. {@code retryable=false} parks a
 * FAILED job immediately regardless of remaining attempts. {@code attempts}
 * echoes the attempt number the worker observed at claim time and is used as a
 * compare-and-set guard so stale reports (expired lease, job reclaimed) are
 * rejected.
 */
public record ReportJobRequest(
        String workerId,
        String outcome,
        String detail,
        Boolean retryable,
        Integer attempts) {
}

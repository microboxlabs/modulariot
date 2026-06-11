package com.microboxlabs.miot.integrations.dto;

/**
 * Worker outcome report. {@code outcome} is SUCCEEDED, SKIPPED (nothing to do —
 * recorded as SUCCEEDED with detail) or FAILED. {@code retryable=false} parks a
 * FAILED job immediately regardless of remaining attempts.
 */
public record ReportJobRequest(
        String workerId,
        String outcome,
        String detail,
        Boolean retryable) {
}

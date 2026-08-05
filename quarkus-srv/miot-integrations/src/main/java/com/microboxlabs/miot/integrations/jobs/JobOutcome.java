package com.microboxlabs.miot.integrations.jobs;

/**
 * Terminal outcome of a {@link ModulithJobHandler}. Retryable failures are
 * thrown, not returned — the worker maps a thrown exception to FAILED and the
 * ledger backs off and retries.
 */
public record JobOutcome(
        String outcome,
        String detail,
        /** What the run produced, persisted to {@code async_jobs.result}; null for most jobs. */
        java.util.Map<String, Object> result) {

    public static final String SUCCEEDED = "SUCCEEDED";
    public static final String SKIPPED = "SKIPPED";

    public static JobOutcome succeeded(String detail) {
        return new JobOutcome(SUCCEEDED, detail, null);
    }

    /** Success that also produced data worth keeping on the job row. */
    public static JobOutcome succeeded(String detail, java.util.Map<String, Object> result) {
        return new JobOutcome(SUCCEEDED, detail, result);
    }

    public static JobOutcome skipped(String detail) {
        return new JobOutcome(SKIPPED, detail, null);
    }
}

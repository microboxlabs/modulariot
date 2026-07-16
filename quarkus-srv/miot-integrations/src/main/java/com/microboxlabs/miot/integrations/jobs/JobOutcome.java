package com.microboxlabs.miot.integrations.jobs;

/**
 * Terminal outcome of a {@link ModulithJobHandler}. Retryable failures are
 * thrown, not returned — the worker maps a thrown exception to FAILED and the
 * ledger backs off and retries.
 */
public record JobOutcome(String outcome, String detail) {

    public static final String SUCCEEDED = "SUCCEEDED";
    public static final String SKIPPED = "SKIPPED";

    public static JobOutcome succeeded(String detail) {
        return new JobOutcome(SUCCEEDED, detail);
    }

    public static JobOutcome skipped(String detail) {
        return new JobOutcome(SKIPPED, detail);
    }
}

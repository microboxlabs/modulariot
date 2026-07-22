package com.microboxlabs.miot.integrations.jobs;

/**
 * Thrown by a {@link ModulithJobHandler} for a failure a retry cannot fix — a
 * deterministic, terminal condition such as a chosen calendar slot being at
 * full capacity. {@link ModulithJobWorker} reports it FAILED with
 * {@code retryable=false}, so the ledger parks the job immediately (on the
 * current attempt) and fires the park notification, instead of burning the
 * whole attempt budget with exponential backoff first.
 *
 * <p>A plain thrown exception stays retryable — that path is for transient /
 * transport / 5xx failures the ledger should back off and re-run. Throw this
 * only when re-running the exact same payload is guaranteed to fail the same
 * way.
 */
public class NonRetryableJobException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public NonRetryableJobException(String message) {
        super(message);
    }

    public NonRetryableJobException(String message, Throwable cause) {
        super(message, cause);
    }
}

package com.microboxlabs.miot.integrations.domain;

/**
 * Lifecycle states of an {@link AsyncJob}.
 *
 * <p>PENDING jobs are runnable (immediately or at {@code nextRetryAt}). RUNNING
 * jobs hold a lease ({@code lockedUntil}); an expired lease makes the job
 * claimable again. FAILED is a parked state reached when attempts are exhausted
 * or the worker reports a non-retryable error — only a manual retry leaves it.
 */
public enum JobState {
    PENDING,
    RUNNING,
    SUCCEEDED,
    FAILED,
    CANCELLED
}

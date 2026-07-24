package com.microboxlabs.miot.integrations.dispatch;

/**
 * What the channel did with the payload.
 *
 * <p>{@code retryable} is the dispatcher's judgement, not the caller's: only it knows whether
 * its channel's particular refusal is transient. The job handler turns this into a
 * {@code JobOutcome} — succeeded, thrown for a retry, or parked — so the retry policy lives
 * with the channel that understands it.
 */
public record DispatchOutcome(boolean success, boolean retryable, String detail) {

    public static DispatchOutcome succeeded(String detail) {
        return new DispatchOutcome(true, false, detail);
    }

    /** The channel refused in a way that will refuse identically forever. */
    public static DispatchOutcome permanentFailure(String detail) {
        return new DispatchOutcome(false, false, detail);
    }

    /** The channel was unavailable or busy; the same payload may land later. */
    public static DispatchOutcome transientFailure(String detail) {
        return new DispatchOutcome(false, true, detail);
    }
}

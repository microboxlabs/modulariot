package com.microboxlabs.miot.core.telephony;

import java.time.Duration;

/** The provider asked us to slow down (HTTP 429, or 503 with {@code Retry-After}). */
// Preserve the existing telephony/IllegalStateException contract (including HTTP 409 mapping).
@SuppressWarnings("java:S110")
public class TelephonyThrottledException extends TelephonyUnavailableException {

    private final Duration retryAfter;

    public TelephonyThrottledException(String message, Duration retryAfter) {
        super(THROTTLED, message);
        this.retryAfter = retryAfter;
    }

    /** How long to wait before the next request to the provider. */
    public Duration retryAfter() {
        return retryAfter;
    }
}

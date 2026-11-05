package com.microboxlabs.miot.core.telephony;

/**
 * The telephony connection cannot do what was asked: missing, not tested, refused by the provider, out of
 * minutes, or with every channel busy. {@code code} names the reason for the app.
 */
public class TelephonyUnavailableException extends IllegalStateException {

    /** No line, a line that did not pass its test, or a provider error. */
    public static final String UNAVAILABLE = "telephony_unavailable";
    /** The managed line's monthly minutes are used and the plan is enforced. */
    public static final String QUOTA_EXHAUSTED = "telephony_quota_exhausted";
    /** Every channel of the line is in a call. */
    public static final String CHANNELS_BUSY = "telephony_channels_busy";

    private final String code;

    public TelephonyUnavailableException(String message) {
        this(UNAVAILABLE, message);
    }

    public TelephonyUnavailableException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}

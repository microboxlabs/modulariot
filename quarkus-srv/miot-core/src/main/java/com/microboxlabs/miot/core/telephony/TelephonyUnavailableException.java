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
    /** A complete report needs a smaller time window. */
    public static final String CALL_RECORDS_PAGE_LIMIT = "telephony_call_records_page_limit";
    /** WhatsApp calling is not configured, or the organization's line cannot reach it. */
    public static final String WHATSAPP_UNAVAILABLE = "whatsapp_calling_unavailable";
    /** The contact has not allowed the business number to call (Meta answers SIP 403). */
    public static final String WHATSAPP_NO_PERMISSION = "whatsapp_no_permission";
    /** The ringing WhatsApp call was answered by another operator, or ended. */
    public static final String WHATSAPP_CALL_TAKEN = "whatsapp_call_taken";

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

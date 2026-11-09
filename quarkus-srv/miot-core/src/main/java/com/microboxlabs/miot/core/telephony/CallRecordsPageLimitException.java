package com.microboxlabs.miot.core.telephony;

/** The report needs a smaller time window to return a complete candidate set. */
public class CallRecordsPageLimitException extends TelephonyUnavailableException {

    public CallRecordsPageLimitException(String message) {
        super(message);
    }
}

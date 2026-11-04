package com.microboxlabs.miot.core.telephony;

/** The telephony connection cannot do what was asked: missing, not tested, or refused by the provider. */
public class TelephonyUnavailableException extends IllegalStateException {

    public TelephonyUnavailableException(String message) {
        super(message);
    }
}

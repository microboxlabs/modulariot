package com.microboxlabs.miot.integrations.orgaccount;

/** A Google API call that failed, with its HTTP status and Google's own message. */
public class GoogleCallException extends RuntimeException {

    private final int status;

    public GoogleCallException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int status() {
        return status;
    }
}

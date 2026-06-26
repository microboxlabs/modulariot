package com.microboxlabs.miot.conversational.client;

/**
 * Raised when a send to the Meta Graph API does not succeed — a transport error or a
 * non-2xx response. {@link #httpStatus()} carries Meta's HTTP status when the call
 * completed, or {@code null} when the request never reached Meta.
 */
public class WhatsAppSendException extends RuntimeException {

    private final Integer httpStatus;

    public WhatsAppSendException(String message, Integer httpStatus, Throwable cause) {
        super(message, cause);
        this.httpStatus = httpStatus;
    }

    public Integer httpStatus() {
        return httpStatus;
    }
}

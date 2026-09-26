package com.microboxlabs.miot.core.selectable;

/**
 * A list's source could not answer: the service behind it is down, refused
 * the call, or sent something unreadable. The API returns it as a 502, so a
 * field shows an error instead of an empty list.
 */
public class SourceUnavailableException extends RuntimeException {

    public SourceUnavailableException(String message) {
        super(message);
    }

    public SourceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}

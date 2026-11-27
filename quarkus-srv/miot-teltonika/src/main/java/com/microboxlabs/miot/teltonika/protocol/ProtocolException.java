package com.microboxlabs.miot.teltonika.protocol;

/**
 * The bytes received do not follow the Teltonika protocol. The connection is closed.
 */
public class ProtocolException extends RuntimeException {

    public ProtocolException(String message) {
        super(message);
    }

    public ProtocolException(String message, Throwable cause) {
        super(message, cause);
    }
}

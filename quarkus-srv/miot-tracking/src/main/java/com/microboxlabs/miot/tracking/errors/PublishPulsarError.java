package com.microboxlabs.miot.tracking.errors;

public class PublishPulsarError extends RuntimeException {

    public PublishPulsarError(String message) {
        super(message);
    }

    public PublishPulsarError(String message, Throwable cause) {
        super(message, cause);
    }
}

package com.microboxlabs.miot.integrations.auth;

public class AuthResolutionException extends RuntimeException {

    public AuthResolutionException(String message) {
        super(message);
    }

    public AuthResolutionException(String message, Throwable cause) {
        super(message, cause);
    }
}

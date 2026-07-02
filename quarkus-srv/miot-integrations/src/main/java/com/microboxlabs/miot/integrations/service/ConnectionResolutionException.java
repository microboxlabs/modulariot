package com.microboxlabs.miot.integrations.service;

/**
 * Thrown when no usable connection of a requested provider can be resolved for a tenant
 * (none configured, or its credential is unreadable). Distinct from a transport failure
 * when actually calling the provider — this is a precondition / configuration problem.
 */
public class ConnectionResolutionException extends RuntimeException {

    public ConnectionResolutionException(String message) {
        super(message);
    }

    public ConnectionResolutionException(String message, Throwable cause) {
        super(message, cause);
    }
}

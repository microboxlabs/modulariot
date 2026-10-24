package com.microboxlabs.miot.integrations.service;

/** The tenant has no connection of the provider; a connection that exists but cannot be read is not this. */
public class ConnectionNotConfiguredException extends ConnectionResolutionException {

    public ConnectionNotConfiguredException(String message) {
        super(message);
    }
}

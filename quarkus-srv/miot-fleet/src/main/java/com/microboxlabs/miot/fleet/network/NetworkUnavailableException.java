package com.microboxlabs.miot.fleet.network;

/** The network source is not configured or cannot be read. */
public class NetworkUnavailableException extends RuntimeException {

    public NetworkUnavailableException(String message) {
        super(message);
    }
}

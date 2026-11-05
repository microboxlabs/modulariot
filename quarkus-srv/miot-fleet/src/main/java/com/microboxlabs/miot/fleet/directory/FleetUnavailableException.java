package com.microboxlabs.miot.fleet.directory;

/** No data source is configured for the fleet directory. The API answers 503. */
public class FleetUnavailableException extends RuntimeException {

    public FleetUnavailableException(String message) {
        super(message);
    }
}

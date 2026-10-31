package com.microboxlabs.miot.places.store;

/** The GPS database the geofences live in is not configured. The API answers 503. */
public class GeofencesUnavailableException extends RuntimeException {

    public GeofencesUnavailableException(String message) {
        super(message);
    }
}

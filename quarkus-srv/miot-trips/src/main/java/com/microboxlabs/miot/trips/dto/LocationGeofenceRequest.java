package com.microboxlabs.miot.trips.dto;

/** The GPS geofence a location points at; null removes it. */
public record LocationGeofenceRequest(Integer geofenceId) {
}

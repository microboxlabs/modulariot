package com.microboxlabs.miot.trips.domain;

/** A trip as seen from a mandate: enough to list and link. */
public record TripRef(String tripId, String status, int seq, String role) {
}

package com.microboxlabs.miot.symptoms.dto;

/**
 * Where a case's trip goes: its origin and destination as the trip names them, and their geofence ids when known.
 *
 * @param origin the origin's label, trimmed, or null
 * @param originId the origin's geofence id, or null
 * @param destination the destination's label, trimmed, or null
 * @param destinationId the destination's geofence id, or null
 */
public record TripRoute(String origin, Integer originId, String destination, Integer destinationId) {

    public static final TripRoute NONE = new TripRoute(null, null, null, null);

    /** Blank labels are null. */
    public static TripRoute of(String origin, Integer originId, String destination, Integer destinationId) {
        return new TripRoute(clean(origin), originId, clean(destination), destinationId);
    }

    private static String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

package com.microboxlabs.miot.fleet.directory;

import java.time.Instant;

/**
 * What the integrations know about one asset: its last GPS signal and its trips. Trip shares cover the last 30
 * days; {@code currentTrip} is the trip in progress and {@code nextTrip} the earliest planned one.
 */
public record AssetFacts(String id, String reportedType, Integer year, Instant lastSignalAt, Double lat, Double lon,
        Double speed, Boolean engineOn, String gpsProvider, String senderClientId, String signalDriver,
        TripView currentTrip, TripView nextTrip, int trips30d, double tripHours30d, Share carrier, Share trailer,
        Share driver, Share origin) {
}

package com.microboxlabs.miot.fleet.directory;

import java.time.Instant;

/** One trip of an asset, as the GPS database keeps it. */
public record TripView(String id, String origin, String destination, String status, Instant start, Instant end,
        Instant eta, String carrier, String driver, String trailer) {
}

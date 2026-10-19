package com.microboxlabs.miot.fleet.directory;

import java.time.Instant;

/** One edit of an asset's data. {@code origin} is MANUAL or SUGGESTION. */
public record Change(String field, String oldValue, String newValue, String origin, String changedBy,
        Instant changedAt) {
}

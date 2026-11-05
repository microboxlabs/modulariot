package com.microboxlabs.miot.trips.store;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Trip list filters; a null field does not filter. */
public record TripFilter(String status, UUID mandateId, String assetId, OffsetDateTime from, OffsetDateTime to) {
}

package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/** The physical link: a cargo unit riding on a trip, with load/unload stages when known. */
public record TripCargoLink(
        String tripId,
        String cargoId,
        String tenantCode,
        String loadedAtStage,
        String unloadedAtStage,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {
}

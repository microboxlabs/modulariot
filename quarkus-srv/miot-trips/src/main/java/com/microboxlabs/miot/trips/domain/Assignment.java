package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/** A resource (truck/trailer/driver) assigned to a trip over a validity window. */
public record Assignment(
        String id,
        String tenantCode,
        String tripId,
        String resourceType,
        String resourceId,
        OffsetDateTime validFrom,
        OffsetDateTime validTo,
        String reason,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static final String TRUCK = "truck";
    public static final String TRAILER = "trailer";
    public static final String DRIVER = "driver";
}

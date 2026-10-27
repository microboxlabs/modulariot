package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.Assignment;
import java.time.OffsetDateTime;

/** A resource assignment as the API serves it. */
public record AssignmentView(
        String id,
        String tripId,
        String resourceType,
        String resourceId,
        OffsetDateTime validFrom,
        OffsetDateTime validTo,
        String reason,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static AssignmentView of(Assignment a) {
        return new AssignmentView(a.id(), a.tripId(), a.resourceType(), a.resourceId(),
                a.validFrom(), a.validTo(), a.reason(), a.createdAt(), a.updatedAt());
    }
}

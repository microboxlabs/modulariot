package com.microboxlabs.miot.trips.dto;

import java.time.OffsetDateTime;

/** Body to assign a resource to a trip. */
public record AssignmentRequest(
        String resourceType,
        String resourceId,
        OffsetDateTime validFrom,
        String reason) {
}

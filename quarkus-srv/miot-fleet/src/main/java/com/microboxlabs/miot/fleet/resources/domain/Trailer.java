package com.microboxlabs.miot.fleet.resources.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** A trailer of a carrier. Same structure and ids as ams.rd_trailer. */
public record Trailer(
        String id,
        String tenantCode,
        String carrierId,
        String externalId,
        String licensePlate,
        String vin,
        String trailerType,
        BigDecimal maxWeight,
        String status,
        boolean isOccasional,
        String sourceSystem,
        String sourceData,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {
}

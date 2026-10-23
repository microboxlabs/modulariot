package com.microboxlabs.miot.fleet.resources.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** A truck of a carrier. Same structure and ids as ams.rd_truck. */
public record Truck(
        String id,
        String tenantCode,
        String carrierId,
        String externalId,
        String licensePlate,
        String vin,
        String truckType,
        BigDecimal maxWeight,
        BigDecimal volume,
        String status,
        boolean isOccasional,
        String sourceSystem,
        String sourceData,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {
}

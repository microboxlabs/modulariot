package com.microboxlabs.miot.fleet.resources.domain;

import java.time.OffsetDateTime;

/** A driver, optionally tied to a carrier. Same structure and ids as ams.rd_driver. */
public record Driver(
        String id,
        String tenantCode,
        String carrierId,
        String externalId,
        String rut,
        String firstName,
        String lastName,
        String fullName,
        String phone,
        String mobilePhone,
        String licenseCategory,
        OffsetDateTime licenseExpires,
        String status,
        boolean isOccasional,
        String sourceSystem,
        String sourceData,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {
}

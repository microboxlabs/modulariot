package com.microboxlabs.miot.fleet.resources.domain;

import java.time.OffsetDateTime;

/** A transport company — a resource, never a mandante. Same structure and ids as ams.rd_carrier. */
public record Carrier(
        String id,
        String tenantCode,
        String externalId,
        String rut,
        String legalName,
        String transportLicense,
        OffsetDateTime transportLicenseExpires,
        String contactName,
        String phone,
        String email,
        String status,
        boolean isOccasional,
        String sourceSystem,
        String sourceData,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static final String ACTIVE = "active";
    public static final String INACTIVE = "inactive";
}

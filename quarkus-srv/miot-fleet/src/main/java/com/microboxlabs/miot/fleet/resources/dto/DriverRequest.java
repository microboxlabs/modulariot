package com.microboxlabs.miot.fleet.resources.dto;

import java.time.OffsetDateTime;

/** Create/patch body for a driver. */
public record DriverRequest(
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
        Boolean isOccasional,
        String sourceSystem) {

    public static DriverRequest empty() {
        return new DriverRequest(null, null, null, null, null, null, null, null, null, null, null, null, null);
    }
}

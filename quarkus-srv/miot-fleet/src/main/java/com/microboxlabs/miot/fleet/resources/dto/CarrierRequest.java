package com.microboxlabs.miot.fleet.resources.dto;

import java.time.OffsetDateTime;

/** Create/patch body for a carrier; null keeps, "" clears where it applies. */
public record CarrierRequest(
        String externalId,
        String rut,
        String legalName,
        String transportLicense,
        OffsetDateTime transportLicenseExpires,
        String contactName,
        String phone,
        String email,
        String status,
        Boolean isOccasional,
        String sourceSystem) {

    public static CarrierRequest empty() {
        return new CarrierRequest(null, null, null, null, null, null, null, null, null, null, null);
    }
}

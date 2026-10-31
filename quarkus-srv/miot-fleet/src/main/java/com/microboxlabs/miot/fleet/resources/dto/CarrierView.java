package com.microboxlabs.miot.fleet.resources.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.fleet.resources.domain.Carrier;
import java.time.OffsetDateTime;

/** A carrier as the API serves it. */
public record CarrierView(
        String id,
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
        JsonNode sourceData,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static CarrierView of(Carrier c) {
        return new CarrierView(c.id(), c.externalId(), c.rut(), c.legalName(), c.transportLicense(),
                c.transportLicenseExpires(), c.contactName(), c.phone(), c.email(), c.status(),
                c.isOccasional(), c.sourceSystem(), Jsons.node(c.sourceData()), c.createdAt(), c.updatedAt());
    }
}

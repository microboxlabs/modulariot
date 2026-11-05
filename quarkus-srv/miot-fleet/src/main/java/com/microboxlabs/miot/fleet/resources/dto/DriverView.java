package com.microboxlabs.miot.fleet.resources.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.fleet.resources.domain.Driver;
import java.time.OffsetDateTime;

/** A driver as the API serves it. */
public record DriverView(
        String id,
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
        JsonNode sourceData,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static DriverView of(Driver d) {
        return new DriverView(d.id(), d.carrierId(), d.externalId(), d.rut(), d.firstName(), d.lastName(),
                d.fullName(), d.phone(), d.mobilePhone(), d.licenseCategory(), d.licenseExpires(), d.status(),
                d.isOccasional(), d.sourceSystem(), Jsons.node(d.sourceData()), d.createdAt(), d.updatedAt());
    }
}

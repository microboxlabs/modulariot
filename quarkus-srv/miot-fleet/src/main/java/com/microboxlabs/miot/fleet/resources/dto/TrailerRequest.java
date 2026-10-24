package com.microboxlabs.miot.fleet.resources.dto;

import java.math.BigDecimal;

/** Create/patch body for a trailer. */
public record TrailerRequest(
        String carrierId,
        String externalId,
        String licensePlate,
        String vin,
        String trailerType,
        BigDecimal maxWeight,
        String status,
        Boolean isOccasional,
        String sourceSystem) {

    public static TrailerRequest empty() {
        return new TrailerRequest(null, null, null, null, null, null, null, null, null);
    }
}

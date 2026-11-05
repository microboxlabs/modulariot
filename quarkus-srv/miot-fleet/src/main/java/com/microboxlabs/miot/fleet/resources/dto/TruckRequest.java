package com.microboxlabs.miot.fleet.resources.dto;

import java.math.BigDecimal;

/** Create/patch body for a truck. */
public record TruckRequest(
        String carrierId,
        String externalId,
        String licensePlate,
        String vin,
        String truckType,
        BigDecimal maxWeight,
        BigDecimal volume,
        String status,
        Boolean isOccasional,
        String sourceSystem) {

    public static TruckRequest empty() {
        return new TruckRequest(null, null, null, null, null, null, null, null, null, null);
    }
}

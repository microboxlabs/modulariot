package com.microboxlabs.miot.fleet.resources.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.fleet.resources.domain.Truck;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** A truck as the API serves it. */
public record TruckView(
        String id,
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
        JsonNode sourceData,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static TruckView of(Truck t) {
        return new TruckView(t.id(), t.carrierId(), t.externalId(), t.licensePlate(), t.vin(), t.truckType(),
                t.maxWeight(), t.volume(), t.status(), t.isOccasional(), t.sourceSystem(),
                Jsons.node(t.sourceData()), t.createdAt(), t.updatedAt());
    }
}

package com.microboxlabs.miot.fleet.resources.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.fleet.resources.domain.Trailer;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** A trailer as the API serves it. */
public record TrailerView(
        String id,
        String carrierId,
        String externalId,
        String licensePlate,
        String vin,
        String trailerType,
        BigDecimal maxWeight,
        String status,
        boolean isOccasional,
        String sourceSystem,
        JsonNode sourceData,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static TrailerView of(Trailer t) {
        return new TrailerView(t.id(), t.carrierId(), t.externalId(), t.licensePlate(), t.vin(),
                t.trailerType(), t.maxWeight(), t.status(), t.isOccasional(), t.sourceSystem(),
                Jsons.node(t.sourceData()), t.createdAt(), t.updatedAt());
    }
}

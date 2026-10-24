package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/** A named place trips and mandates point at: planta, puerto, cd, cliente or zona. */
public record Location(
        String id,
        String tenantCode,
        String name,
        String type,
        String externalCode,
        String geomGeojson,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {
}

package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.trips.domain.Location;
import java.time.OffsetDateTime;

/** A location as the API serves it. */
public record LocationView(
        String id,
        String name,
        String type,
        String externalCode,
        JsonNode geomGeojson,
        Integer geofenceId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static LocationView of(Location l) {
        return new LocationView(l.id(), l.name(), l.type(), l.externalCode(), Jsons.node(l.geomGeojson()),
                l.geofenceId(), l.createdAt(), l.updatedAt());
    }
}

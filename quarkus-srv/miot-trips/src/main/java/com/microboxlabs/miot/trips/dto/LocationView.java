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
        String address,
        String country,
        String districtCode,
        String district,
        String plusCode,
        Double latitude,
        Double longitude,
        String resolutionSource,
        String resolutionStatus,
        String resolutionNote,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static LocationView of(Location l) {
        Location.Placement p = l.placement();
        return new LocationView(l.id(), l.name(), l.type(), l.externalCode(), Jsons.node(l.geomGeojson()),
                l.geofenceId(), p.address(), p.country(), p.districtCode(), p.districtName(), p.plusCode(),
                p.latitude(), p.longitude(), p.source(), p.status(), p.note(), l.createdAt(), l.updatedAt());
    }
}

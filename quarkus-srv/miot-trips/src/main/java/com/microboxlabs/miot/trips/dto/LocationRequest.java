package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.databind.JsonNode;

/** Create/patch body for a location. */
public record LocationRequest(
        String name,
        String type,
        String externalCode,
        JsonNode geomGeojson) {

    public static LocationRequest empty() {
        return new LocationRequest(null, null, null, null);
    }
}

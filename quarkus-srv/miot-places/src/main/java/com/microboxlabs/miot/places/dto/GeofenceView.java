package com.microboxlabs.miot.places.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.places.store.GeofenceStore;

/** A geofence as the API serves it; {@code shape} is a GeoJSON geometry. */
public record GeofenceView(
        int id,
        String code,
        String name,
        String polygonType,
        String category,
        JsonNode shape,
        JsonNode properties) {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static GeofenceView of(GeofenceStore.Geofence g) {
        return new GeofenceView(g.id(), g.code(), g.name(), g.polygonType(), g.category(), node(g.shapeGeojson()),
                node(g.propertiesJson()));
    }

    private static JsonNode node(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readTree(json);
        } catch (Exception e) {
            throw new IllegalStateException("stored JSON is unreadable", e);
        }
    }
}

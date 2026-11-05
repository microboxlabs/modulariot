package com.microboxlabs.miot.places.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.places.store.PlaceStore;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * A place as the API serves it; {@code geojson} is the GeoJSON Feature the map draws and edits. {@code inners} is set
 * when a geofence is saved or read on its own, and null in a list, where inner geofences come as rows of their own.
 */
public record PlaceView(
        String id,
        String kind,
        String parentId,
        String externalCode,
        String name,
        String icon,
        String color,
        String address,
        JsonNode categories,
        JsonNode metadata,
        JsonNode geojson,
        OffsetDateTime validFrom,
        OffsetDateTime validUntil,
        String currentVersion,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy,
        List<PlaceView> inners) {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static PlaceView of(PlaceStore.Place p) {
        return of(p, null);
    }

    public static PlaceView of(PlaceStore.Place p, List<PlaceStore.Place> inners) {
        return new PlaceView(p.id().toString(), p.kind(), p.parentId() == null ? null : p.parentId().toString(),
                p.externalCode(), p.name(), p.icon(), p.color(), p.address(),
                node(p.categoriesJson()), node(p.metadataJson()), node(p.geojson()), p.validFrom(), p.validUntil(),
                p.currentVersion(),
                p.createdAt(), p.createdBy(), p.updatedAt(), p.updatedBy(),
                inners == null ? null : inners.stream().map(PlaceView::of).toList());
    }

    static JsonNode node(String json) {
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

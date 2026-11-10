package com.microboxlabs.miot.places.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.places.store.PlaceStore;
import java.time.OffsetDateTime;

/**
 * One version of a geofence or route: its number, the size of the edit ({@code null} for the first, {@code 1.0.0}),
 * the description and what changed, and the place as it was saved, with its inner geofences.
 */
public record PlaceVersionView(
        String version,
        String bump,
        String reason,
        JsonNode changes,
        JsonNode snapshot,
        String createdBy,
        OffsetDateTime createdAt) {

    public static PlaceVersionView of(PlaceStore.PlaceVersion v) {
        return new PlaceVersionView(v.version(), v.bump(), v.reason(), PlaceView.node(v.changesJson()),
                PlaceView.node(v.snapshotJson()), v.createdBy(), v.createdAt());
    }
}

package com.microboxlabs.miot.places.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * A geofence or route to create or replace, or one inner geofence inside a geofence's {@code inners}. {@code kind} is
 * {@code geofence} or {@code route} and cannot change on an update. {@code geojson} is a GeoJSON Feature: a Polygon,
 * a Point with {@code properties.radius_m} (a circle, stored as a polygon) or, for a route, a LineString.
 *
 * <p>A geofence's {@code inners} are all its inner geofences: one with the {@code id} of a current inner geofence
 * replaces it, one without an {@code id} is new, and a current one left out is deleted. Without {@code inners} they
 * stay as they are. {@code version} is required to replace a place: every edit is a version.
 */
public record PlaceRequest(
        String kind,
        String parentId,
        String externalCode,
        String name,
        String icon,
        String color,
        String address,
        Categories categories,
        JsonNode metadata,
        JsonNode geojson,
        OffsetDateTime validFrom,
        OffsetDateTime validUntil,
        String id,
        List<PlaceRequest> inners,
        VersionRequest version) {

    /** The chosen {@code values}, codes of the {@code selectable} that gives their names. */
    public record Categories(String selectable, List<String> values) {
    }

    /**
     * The size of an edit, {@code MAJOR}, {@code MINOR} or {@code PATCH}, the description of whoever edits and what
     * changed, in words.
     */
    public record VersionRequest(String bump, String reason, List<String> changes) {
    }
}

package com.microboxlabs.miot.places.store;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The tenant's places in the modulith database ({@code miot_places.place}): geofences, inner geofences and routes,
 * and the versions of each geofence and route ({@code miot_places.place_version}). Every call is tenant-scoped and
 * sees only active places; a delete is logical.
 */
public interface PlaceStore {

    String GEOFENCE = "geofence";
    String INNER_GEOFENCE = "inner_geofence";
    String ROUTE = "route";
    List<String> KINDS = List.of(GEOFENCE, INNER_GEOFENCE, ROUTE);
    /** The kinds copied to StreamHub, each by its code; a route is not. */
    List<String> SYNCED_KINDS = List.of(GEOFENCE, INNER_GEOFENCE);

    /**
     * {@code metadataJson} and {@code geojson} are JSON text; {@code geojson} a GeoJSON Feature.
     * {@code categoriesJson} is JSON text too, {@code selectable} and {@code values}, or null without categories.
     * {@code currentVersion} is the latest version of a geofence or route; an inner geofence has none, it is versioned
     * with its geofence. {@code externalCode} with the tenant is the geofence's key in the GPS {@code geofences} table
     * ({@code client_id}, {@code client_geofence_id}); deleting the place frees it.
     */
    record Place(UUID id, String tenantCode, String kind, UUID parentId, String externalCode, String name, String icon,
            String color, String address, String categoriesJson, String metadataJson, String geojson,
            OffsetDateTime validFrom, OffsetDateTime validUntil, String currentVersion, OffsetDateTime createdAt,
            String createdBy, OffsetDateTime updatedAt, String updatedBy) {
    }

    /**
     * One version of a geofence or route. {@code bump} is null for the first, {@code 1.0.0}; {@code changesJson} is
     * a JSON array of what changed, in words, and {@code snapshotJson} the place as it was saved, with its inner
     * geofences.
     */
    record PlaceVersion(UUID id, UUID placeId, String tenantCode, String version, String bump, String reason,
            String changesJson, String snapshotJson, String createdBy, OffsetDateTime createdAt) {
    }

    /** The place that holds a code. */
    record CodeOwner(UUID id, String name, String kind, String externalCode) {
    }

    /** A geofence or inner geofence StreamHub does not have as it is: to copy, or, {@code deleted}, to remove. */
    record Pending(Place place, boolean deleted) {
    }

    /** {@code createdBy} is the actor; id and timestamps come from the database. */
    Place insert(Place place);

    Optional<Place> find(String tenantCode, UUID id);

    /** Which active place holds the code in the organization, whatever its case. */
    Optional<CodeOwner> findByCode(String tenantCode, String code);

    /** By name or code when {@code q} is set; {@code kind} and {@code parentId} filter when set. */
    List<Place> list(String tenantCode, String kind, UUID parentId, String q, int limit, long offset);

    /** The geofence's inner geofences, by name. */
    List<Place> children(String tenantCode, UUID parentId);

    /**
     * Replaces the editable fields and the current version; the kind stays. Empty when
     * there is no such place.
     */
    Optional<Place> update(Place place);

    /**
     * Deactivates the active place that holds the code in the organization, whatever its case; false when none
     * does. Deleting frees the code.
     */
    boolean delete(String tenantCode, String externalCode, String actor);

    /** {@code createdBy} is the actor; id and time come from the database. */
    PlaceVersion insertVersion(PlaceVersion version);

    /** The place's versions, oldest first. */
    List<PlaceVersion> versions(String tenantCode, UUID placeId);

    /**
     * Records that StreamHub has the place as {@code place} was saved or, {@code deleted}, no longer has it. False
     * when it changed since, or is not a kind StreamHub gets: it stays pending.
     */
    boolean markSynced(Place place, boolean deleted);

    /**
     * Makes the place pending again whatever StreamHub has: a copy that lost a race with a newer one may have written
     * an older version over it, and the retry copies the current one.
     */
    void markPending(Place place);

    /**
     * Of every organization, the geofences and inner geofences StreamHub does not have as they are, the deleted ones
     * first: a code a deleted place freed may be another's now.
     */
    List<Pending> pending(int limit);
}

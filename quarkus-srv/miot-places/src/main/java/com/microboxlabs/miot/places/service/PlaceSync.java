package com.microboxlabs.miot.places.service;

import com.microboxlabs.miot.places.store.PlaceStore.Place;

/**
 * Hears every place {@link PlaceService} writes, one call per place: a geofence, each of its inner geofences and a
 * route, each by its organization and code, the key of a geofence in the GPS geofences ({@code client_id},
 * {@code client_geofence_id}). This is where they are copied to StreamHub: a geofence and each inner geofence, as a
 * geofence of its own; a route is heard but never copied.
 *
 * <p>It is called once the write has committed, so it never sees a write that rolled back. A failure here does not
 * undo the write: the place stays pending ({@code synced_at} before {@code updated_at}) and {@link PlaceSyncRetry}
 * tries it again. Both calls must be idempotent: a retry may repeat one that worked.
 */
public interface PlaceSync {

    /** The place was created or edited; {@code place} is how it was saved. */
    void saved(String tenantCode, String externalCode, Place place);

    /**
     * The place that held the code was deleted, or no longer holds it (a route's code changed). {@code kind} is
     * {@code geofence}, {@code inner_geofence} or {@code route}. StreamHub deletes it for good; one it never had is
     * no failure.
     */
    void deleted(String tenantCode, String externalCode, String kind);

    /**
     * Whether a call that returns means StreamHub has it: only then is the place marked synced. While false nothing
     * is called, and what is written meanwhile stays pending until it copies again.
     */
    default boolean copies() {
        return true;
    }

    /** Hears nothing: for tests and stores without StreamHub. */
    static PlaceSync none() {
        return new PlaceSync() {
            @Override
            public void saved(String tenantCode, String externalCode, Place place) {
                // nothing to copy
            }

            @Override
            public void deleted(String tenantCode, String externalCode, String kind) {
                // nothing to remove
            }

            @Override
            public boolean copies() {
                return false;
            }
        };
    }
}

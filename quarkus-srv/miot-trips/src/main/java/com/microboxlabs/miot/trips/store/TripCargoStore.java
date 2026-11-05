package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.TripCargoLink;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The physical cargo-on-trip links. Every call is tenant-scoped. */
public interface TripCargoStore {

    /** Links; a DB trigger upserts the contractual trip_mandate link. Returns empty when already linked. */
    Optional<TripCargoLink> insert(TripCargoLink link);

    Optional<TripCargoLink> find(String tenantCode, UUID tripId, UUID cargoId);

    List<TripCargoLink> listByTrip(String tenantCode, UUID tripId);

    /** Sets the load/unload stages. */
    Optional<TripCargoLink> update(TripCargoLink link);

    boolean delete(String tenantCode, UUID tripId, UUID cargoId);

    /** Closing a load stage picks up its cargo: announced or ready → picked_up. Returns rows moved. */
    int markLoadedByStage(String tenantCode, UUID stageId, String actor);

    /** Closing an unload stage delivers its cargo: picked_up → delivered. Returns rows moved. */
    int markDeliveredByStage(String tenantCode, UUID stageId, String actor);
}

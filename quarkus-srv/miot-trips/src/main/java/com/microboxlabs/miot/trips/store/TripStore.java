package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.Trip;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Trips (legs) and their contractual links to mandates. Every call is tenant-scoped. */
public interface TripStore {

    Trip insert(Trip trip);

    Optional<Trip> find(String tenantCode, UUID id);

    List<Trip> list(String tenantCode, TripFilter filter, int page, int size);

    Optional<Trip> update(Trip trip);

    /** Links the mandate; returns false when the link already existed. */
    boolean linkMandate(String tenantCode, UUID tripId, UUID mandateId, int seq, String role, String actor);

    boolean unlinkMandate(String tenantCode, UUID tripId, UUID mandateId);

    List<MandateRef> mandatesOf(String tenantCode, UUID tripId);

    /** Trips not yet realized or cancelled that start, end or have a stage at the location. */
    List<UUID> openTripsAt(String tenantCode, UUID locationId);

    /** Cargo units of that mandate currently linked to the trip (guards unlink). */
    int cargoOfMandateOnTrip(String tenantCode, UUID tripId, UUID mandateId);
}

package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.TripLiveProjection;
import com.microboxlabs.miot.trips.domain.TripLiveRow;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The hot projection: {@code TripLiveProjector} writes the trip's fields, the motor its own. */
public interface TripLiveStore {

    List<TripLiveRow> list(String tenantCode);

    Optional<TripLiveRow> find(String tenantCode, UUID tripId);

    /** Locks the parent trip before reading its current hot row; call inside a transaction. */
    Optional<TripLiveRow> lockWatched(String tenantCode, UUID tripId);

    /** Inserts or replaces the projected fields; the motor-state fields keep their values. */
    void upsert(TripLiveProjection projection);

    void delete(String tenantCode, UUID tripId);

    /** Every tenant's rows with a vehicle and at least one geofence: the trips whose geofence edges are signals. */
    List<TripLiveRow> watched();

    /** The motor-state fields: the trip geofence the vehicle is in, and whether it reached origin and destination. */
    void saveMotorState(String tenantCode, UUID tripId, Integer currentGeofenceId, boolean originVisited,
            boolean destinationVisited);
}

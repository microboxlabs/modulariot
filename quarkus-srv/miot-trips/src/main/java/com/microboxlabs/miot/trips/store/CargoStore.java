package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.CargoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Cargo units (partials of a mandate line). Every call is tenant-scoped. */
public interface CargoStore {

    /** Inserts with the next partial_no of the line. */
    CargoUnit insert(CargoUnit cargo);

    Optional<CargoUnit> find(String tenantCode, UUID id);

    /** The mandate that owns the cargo, through its current line. */
    Optional<UUID> mandateOf(String tenantCode, UUID cargoId);

    List<CargoUnit> listByMandate(String tenantCode, UUID mandateId);

    /** Cargo units currently linked to the trip. */
    List<CargoUnit> listByTrip(String tenantCode, UUID tripId);

    Optional<CargoUnit> update(CargoUnit cargo);

    /** Locks, in id order, the trips that carry the cargo and returns them: a trip's lock comes before its cargo's. */
    List<UUID> lockTripsCarrying(String tenantCode, UUID cargoId);
}

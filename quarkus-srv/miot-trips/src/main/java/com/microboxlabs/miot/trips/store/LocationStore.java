package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.Location;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Locations. Every call is tenant-scoped. */
public interface LocationStore {

    Location insert(Location location);

    Optional<Location> find(String tenantCode, UUID id);

    List<Location> list(String tenantCode, String q, String type, int page, int size);

    Optional<Location> update(Location location);
}

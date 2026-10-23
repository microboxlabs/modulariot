package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.TripLiveRow;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Read-only access to the hot projection; triggers and the motor write it. */
public interface TripLiveStore {

    List<TripLiveRow> list(String tenantCode);

    Optional<TripLiveRow> find(String tenantCode, UUID tripId);
}

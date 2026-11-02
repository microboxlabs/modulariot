package com.microboxlabs.miot.core.trips;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;

/** Optional trips-module map data. */
public interface TripGeofences {
    JsonNode geofences(String tenantCode, UUID tripId);
}

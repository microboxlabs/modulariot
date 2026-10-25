package com.microboxlabs.miot.trips.service;

import java.util.Map;

/** Hears every audited change of a trip, in the transaction of the change. */
@FunctionalInterface
public interface TripChanges {

    TripChanges NONE = (tenantCode, actor, action, tripId, details) -> {
    };

    void changed(String tenantCode, String actor, String action, String tripId, Map<String, Object> details);
}

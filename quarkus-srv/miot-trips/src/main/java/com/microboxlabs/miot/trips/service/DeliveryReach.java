package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.trips.domain.DeliveryCycle;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Whether every load of a trip reached a delivery step. */
@FunctionalInterface
public interface DeliveryReach {

    DeliveryReach NONE = (tenantCode, tripId, step) -> false;

    boolean reached(String tenantCode, UUID tripId, String step);

    /** All step flags from one snapshot; stores may override to share their reads. */
    default Map<String, Boolean> snapshot(String tenantCode, UUID tripId) {
        Map<String, Boolean> result = new LinkedHashMap<>();
        DeliveryCycle.STEPS.forEach(step -> result.put(step, reached(tenantCode, tripId, step)));
        return Map.copyOf(result);
    }
}

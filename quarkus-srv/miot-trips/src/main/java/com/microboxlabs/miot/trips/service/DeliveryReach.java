package com.microboxlabs.miot.trips.service;

import java.util.UUID;

/** Whether every load of a trip reached a delivery step. */
@FunctionalInterface
public interface DeliveryReach {

    DeliveryReach NONE = (tenantCode, tripId, step) -> false;

    boolean reached(String tenantCode, UUID tripId, String step);
}

package com.microboxlabs.miot.trips.store;

import java.util.Map;
import java.util.UUID;

/** The team that confirms each milestone of a monitor's trips; a milestone without one is open to the permission. */
public interface ConfirmerStore {

    /** Milestone → team of the monitor. */
    Map<String, UUID> ofMonitor(String tenantCode, String monitorKey);

    /** Milestone → team of the monitor the trip follows; empty for a trip without a monitor. */
    Map<String, UUID> ofTrip(String tenantCode, UUID tripId);

    /** Replaces the monitor's teams; a milestone missing from {@code teams} has none. */
    void replace(String tenantCode, String monitorKey, Map<String, UUID> teams, String actor);
}

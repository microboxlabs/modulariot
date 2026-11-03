package com.microboxlabs.miot.core.trips;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** The drivers the trips module assigns to trips, for modules that follow them. Implemented by the trips module. */
public interface TripDrivers {

    /** A driver and the time of its latest assignment. */
    record Assigned(UUID driverId, OffsetDateTime assignedAt) {
    }

    /** Whether the trips module is in the build; without it the reads below find nothing. */
    default boolean listsDrivers() {
        return false;
    }

    /** The tenants that assigned a driver to a trip after {@code since}. */
    default List<String> tenantsAssigningDrivers(OffsetDateTime since) {
        return List.of();
    }

    /**
     * The tenant's drivers assigned to a trip after {@code since}, each once at its latest assignment, ordered by that
     * time and the driver id; at most {@code limit}. {@code afterId} null starts at {@code since}; otherwise the page
     * starts after ({@code since}, {@code afterId}), the last driver of the previous page.
     */
    default List<Assigned> driversAssignedSince(String tenantCode, OffsetDateTime since, UUID afterId, int limit) {
        return List.of();
    }
}

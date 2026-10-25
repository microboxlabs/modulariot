package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.PendingMilestone;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The recorded milestones of each trip; a milestone without a row is open. */
public interface MilestoneStore {

    List<TripMilestone> list(String tenantCode, UUID tripId);

    /** Inside a transaction the row stays locked until it ends. */
    Optional<TripMilestone> find(String tenantCode, UUID tripId, String milestone);

    /** The tenant's milestones waiting for a person, oldest detection first. */
    List<PendingMilestone> pending(String tenantCode, int limit);

    /** Creates or replaces the milestone's row. */
    TripMilestone save(TripMilestone milestone);
}

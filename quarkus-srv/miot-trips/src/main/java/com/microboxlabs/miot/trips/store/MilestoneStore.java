package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.TripMilestone;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The recorded milestones of each trip; a milestone without a row is open. */
public interface MilestoneStore {

    List<TripMilestone> list(String tenantCode, UUID tripId);

    /** Inside a transaction the row stays locked until it ends. */
    Optional<TripMilestone> find(String tenantCode, UUID tripId, String milestone);

    /** Creates or replaces the milestone's row. */
    TripMilestone save(TripMilestone milestone);
}

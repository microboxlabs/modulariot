package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.Assignment;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Resource assignments of a trip (validity windows). Every call is tenant-scoped. */
public interface AssignmentStore {

    /** Inserts; a DB trigger rejects a resource id that does not exist for its type. */
    Assignment insert(Assignment assignment);

    Optional<Assignment> find(String tenantCode, UUID id);

    List<Assignment> listByTrip(String tenantCode, UUID tripId);

    /** Ends the validity window; empty when the assignment is unknown or already ended. */
    Optional<Assignment> end(String tenantCode, UUID id, OffsetDateTime validTo, String reason, String actor);
}

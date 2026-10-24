package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.dto.AssignmentRequest;
import com.microboxlabs.miot.trips.store.AssignmentStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/** Resource assignments with validity windows; ending one and opening another IS the truck change. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class AssignmentService {

    static final String ENTITY = "assignment";
    private static final String RESOURCE_TYPE = "resourceType";
    private static final String RESOURCE_ID = "resourceId";
    /** How far ahead of the server clock a feed's validFrom may be. */
    private static final Duration CLOCK_SKEW = Duration.ofMinutes(5);

    private final AssignmentStore store;
    private final TripStore trips;
    private final FleetResources fleet;
    private final TripLiveProjector live;
    private final AuditService audit;
    private final Transactions tx;

    @Inject
    public AssignmentService(AssignmentStore store, TripStore trips, FleetResources fleet, TripLiveProjector live,
            AuditService audit, Transactions tx) {
        this.store = store;
        this.trips = trips;
        this.fleet = fleet;
        this.live = live;
        this.audit = audit;
        this.tx = tx;
    }

    public List<Assignment> listByTrip(String tenantCode, UUID tripId) {
        trips.find(tenantCode, tripId).orElseThrow(() -> new NoSuchElementException("trip not found"));
        return store.listByTrip(tenantCode, tripId);
    }

    public Assignment create(String tenantCode, String actor, UUID tripId, AssignmentRequest body) {
        return tx.inTransaction(() -> {
            if (body == null) {
                throw new IllegalArgumentException("body is required");
            }
            Trip trip = trips.find(tenantCode, tripId)
                    .orElseThrow(() -> new NoSuchElementException("trip not found"));
            if (Trip.DONE.equals(trip.status()) || Trip.CANCELLED.equals(trip.status())) {
                throw new IllegalStateException("trip already " + trip.status());
            }
            String type = Check.oneOf(Check.required(body.resourceType(), RESOURCE_TYPE, 16), RESOURCE_TYPE,
                    Assignment.TRUCK, Assignment.TRAILER, Assignment.DRIVER);
            String resourceId = Check.required(body.resourceId(), RESOURCE_ID, 64);
            UUID resource = TripService.parse(resourceId, RESOURCE_ID);
            OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
            OffsetDateTime from = body.validFrom() == null ? now : body.validFrom();
            // trip_live shows every open window at once, so a future start would replace today's resource early
            if (from.isAfter(now.plus(CLOCK_SKEW))) {
                throw new IllegalArgumentException("validFrom cannot be in the future; assign the resource when it starts");
            }
            if (!fleet.exists(tenantCode, type, resource)) {
                throw new IllegalArgumentException(type + " " + resourceId + " does not exist or is inactive");
            }
            Assignment created = store.insert(new Assignment(null, tenantCode, tripId.toString(), type, resourceId,
                    from, null, Check.limitedOrNull(body.reason(), "reason", 255), null, actor, null, actor));
            live.refresh(tenantCode, tripId);
            audit.log(tenantCode, actor, "assignment.created", ENTITY, created.id(), tripId.toString(),
                    Map.of(RESOURCE_TYPE, type, RESOURCE_ID, resourceId));
            return created;
        });
    }

    /** Ends the validity window — the truck change. 409 when it already ended. */
    public Assignment end(String tenantCode, String actor, UUID id, OffsetDateTime validTo, String reason) {
        return tx.inTransaction(() -> {
            Assignment current = store.find(tenantCode, id)
                    .orElseThrow(() -> new NoSuchElementException("assignment not found"));
            // lock the trip before the version archive takes a key-share lock on it: two concurrent ends of the
            // same trip then queue here instead of deadlocking on the projector's FOR UPDATE
            trips.find(tenantCode, UUID.fromString(current.tripId()));
            if (current.validTo() != null) {
                throw new IllegalStateException("assignment already ended");
            }
            OffsetDateTime to = validTo == null ? OffsetDateTime.now(ZoneOffset.UTC) : validTo;
            if (current.validFrom() != null && to.isBefore(current.validFrom())) {
                throw new IllegalArgumentException("validTo must not be before validFrom");
            }
            Assignment ended = store.end(tenantCode, id, to, Check.limitedOrNull(reason, "reason", 255), actor)
                    .orElseThrow(() -> new IllegalStateException("assignment already ended"));
            live.refresh(tenantCode, UUID.fromString(ended.tripId()));
            audit.log(tenantCode, actor, "assignment.ended", ENTITY, ended.id(), ended.tripId(),
                    Map.of(RESOURCE_TYPE, ended.resourceType(), RESOURCE_ID, ended.resourceId()));
            return ended;
        });
    }
}

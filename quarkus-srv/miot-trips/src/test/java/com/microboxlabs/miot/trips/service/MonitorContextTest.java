package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.MonitorRun;
import com.microboxlabs.miot.trips.domain.MonitorScope;
import com.microboxlabs.miot.trips.domain.PendingMilestone;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.store.InMemoryFleet;
import com.microboxlabs.miot.trips.store.InMemoryTripsWorld;
import com.microboxlabs.miot.trips.store.MilestoneStore;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MonitorContextTest {
    @Test
    void replacementVehiclesAndFirstDriverMatchTheLiveProjection() {
        InMemoryTripsWorld world = new InMemoryTripsWorld();
        InMemoryFleet fleet = new InMemoryFleet();
        OffsetDateTime earlier = OffsetDateTime.now(ZoneOffset.UTC).minusHours(2);
        OffsetDateTime later = earlier.plusHours(1);
        Trip trip = world.tripStore.insert(new Trip(null, "test", Trip.PLANNED, null, null, null,
                null, null, null, null, "test", null, "test"));
        for (String type : new String[] {Assignment.TRUCK, Assignment.TRAILER}) {
            assign(world, trip, type, fleet.add(new FleetResources.Vehicle("TEST-OLD", null)), earlier);
            assign(world, trip, type, fleet.add(new FleetResources.Vehicle("TEST-NEW", null)), later);
        }
        assign(world, trip, Assignment.DRIVER,
                fleet.add(new FleetResources.Driver("TEST-FIRST", "Test Driver", null)), earlier);
        assign(world, trip, Assignment.DRIVER,
                fleet.add(new FleetResources.Driver("TEST-SECOND", "Test Driver", null)), later);
        MonitorContext context = new MonitorContext(world.tripStore, world.stageStore, world.assignmentStore,
                world.locationStore, new MandateService(world.mandateStore, new AuditService(world.auditStore),
                        Transactions.none()), new MilestoneService(new MilestoneStore() {
                            @Override
                            public List<TripMilestone> list(String tenantCode, UUID tripId) {
                                return List.of();
                            }

                            @Override
                            public Optional<TripMilestone> find(String tenantCode, UUID tripId, String milestone) {
                                return Optional.empty();
                            }

                            @Override
                            public TripMilestone save(TripMilestone milestone) {
                                throw new UnsupportedOperationException();
                            }

                            @Override
                            public List<PendingMilestone> pending(String tenantCode, int limit) {
                                return List.of();
                            }
                        }, world.tripStore, new AuditService(world.auditStore), Transactions.none()), fleet);
        Map<String, Object> result = context.of(trip,
                new MonitorRun.Event("test", trip.id(), "plan", "resources", later, "test", Map.of()), Map.of());
        assertEquals(Map.of("id", trip.id(), "status", Trip.PLANNED), result.get("trip"),
                "absent locations stay absent so has(trip.origin) remains false");
        assertEquals(new MonitorScope.Trip(null, null, null, null), context.scopeOf(trip, null));
        assertEquals(Map.of(
                "truck", Map.of("key", "TEST-NEW", "since", later.toInstant()),
                "trailer", Map.of("key", "TEST-NEW", "since", later.toInstant()),
                "driver", Map.of("key", "TEST-FIRST", "since", earlier.toInstant())), result.get("assignments"));
    }

    private void assign(InMemoryTripsWorld world, Trip trip, String type, UUID resource, OffsetDateTime at) {
        world.assignmentStore.insert(new Assignment(null, "test", trip.id(), type, resource.toString(), at,
                null, null, null, "test", null, "test"));
    }
}

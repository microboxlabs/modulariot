package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.FeedService;
import com.microboxlabs.miot.trips.dto.FeedResult;
import com.microboxlabs.miot.trips.dto.FeedProfileRequest;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.store.FeedStore;
import com.microboxlabs.miot.trips.store.InMemoryFleet;
import com.microboxlabs.miot.trips.store.InMemoryTripsWorld;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class FeedReconcilerTest {
    private final InMemoryTripsWorld world = new InMemoryTripsWorld();
    private final InMemoryFleet fleet = new InMemoryFleet();
    private final TestTransactions tx = new TestTransactions();
    private final TestFeeds feeds = new TestFeeds();
    private final AuditService audit = new AuditService(world.auditStore);
    private final TripLiveProjector live = world.projector(fleet);
    private final MandateService mandates = new MandateService(world.mandateStore, audit, tx);
    private final TripService trips = new TripService(world.tripStore, world.stageStore, world.assignmentStore,
            world.tripCargoStore, world.cargoStore, mandates, live, audit, tx);
    private final StageService stages = new StageService(world.stageStore, world.tripStore, world.tripCargoStore,
            mandates, live, audit, tx);
    private final AssignmentService assignments = new AssignmentService(world.assignmentStore, world.tripStore,
            fleet, live, audit, tx);
    private final ObjectMapper json = JsonMapper.builder().findAndAddModules().build();
    private final FeedReconciler reconciler = new FeedReconciler(feeds, mandates, trips, stages, assignments,
            new LocationService(world.locationStore, new com.microboxlabs.miot.trips.store.FakeGeofences(),
                    world.tripStore, live, audit, tx), fleet, tx, json, Clock.systemUTC());

    private FeedServiceRequest desired(String trailer, List<String> drivers) {
        return new FeedServiceRequest("service", "test reference", OffsetDateTime.now().plusHours(2),
                OffsetDateTime.now().plusHours(5), new FeedServiceRequest.Resources(null, trailer, drivers), null);
    }

    private FeedResult send(FeedServiceRequest request) {
        return reconciler.reconcile("test", "test:actor", "test-feed", "S-TEST", request, false);
    }

    private List<String> driverIds(FeedResult result) {
        return trips.detail("test", UUID.fromString(result.tripId())).assignments().stream()
                .filter(a -> a.validTo() == null && a.resourceType().equals("driver"))
                .map(a -> a.resourceId()).toList();
    }

    @Test
    void optionalMissingResourcesProduceWarnings() {
        FeedServiceRequest request = desired("missing-trailer", List.of("missing-driver"));
        request = new FeedServiceRequest(request.orderType(), request.orderRef(), request.plannedStart(),
                request.plannedEnd(), new FeedServiceRequest.Resources("missing-truck", "missing-trailer",
                        List.of("missing-driver")), null);
        FeedResult result = send(request);
        assertEquals(3, result.warnings().size());
        assertEquals(FeedReconciler.CREATE, result.action());
    }

    @Test
    void clearsTrailerAndExplicitlyEmptyDriversButKeepsUnresolvedInput() {
        fleet.add("trailer", "TEST-123", true);
        UUID driver = fleet.add("driver", "TEST-D1", true);
        send(desired("TEST-123", List.of("TEST-D1")));
        FeedResult unresolved = send(desired("MISSING", List.of("MISSING")));
        assertEquals(List.of(driver.toString()), driverIds(unresolved));
        FeedResult cleared = send(desired(null, List.of()));
        assertTrue(trips.detail("test", UUID.fromString(cleared.tripId())).assignments().stream()
                .noneMatch(a -> a.validTo() == null));
    }

    @Test
    void reorderedDriversChangeThePrimaryDriver() {
        UUID first = fleet.add("driver", "TEST-D1", true);
        UUID second = fleet.add("driver", "TEST-D2", true);
        send(desired(null, List.of("TEST-D1", "TEST-D2")));
        FeedResult swapped = send(desired(null, List.of("TEST-D2", "TEST-D1")));
        assertEquals(List.of(second.toString(), first.toString()), driverIds(swapped));
    }

    @Test
    void recheckReadsTheStateOnlyAfterEnteringTheTransaction() throws Exception {
        send(desired(null, List.of()));
        FeedService previous = feeds.saved;
        String latest = json.writeValueAsString(desired(null, List.of()));
        tx.onEnter = () -> feeds.saved = new FeedService(previous.tenantCode(), previous.feedKey(),
                previous.externalCode(), latest, "new-hash", previous.mandateId(), previous.tripId(), true,
                previous.lastAction(), previous.lastResult(), previous.lastReconciledAt());
        feeds.requireTransaction = true;
        reconciler.recheck("test", "test-feed", "S-TEST");
        assertEquals(json.readTree(latest), json.readTree(feeds.saved.desired()));
    }

    @Test
    void recordsFailureBeforeReleasingTheServiceTransaction() {
        FeedServiceRequest request = desired(null, List.of());
        request = new FeedServiceRequest("x".repeat(100), request.orderRef(), request.plannedStart(), request.plannedEnd(),
                request.resources(), null);
        FeedServiceRequest invalid = request;
        assertThrows(IllegalArgumentException.class, () -> send(invalid));
        assertEquals(1, tx.outerTransactions);
        assertEquals(FeedReconciler.ERROR, feeds.saved.lastAction());
    }

    @Test
    void reportedStateCanBeSubmittedAgain() {
        FeedServiceRequest incomplete = new FeedServiceRequest(null, null, null, null, null, null);
        assertEquals(FeedReconciler.REPORT, send(incomplete).action());
        assertTrue(reconciler.accept("test", "test-feed", "S-TEST", incomplete));
    }

    @Test
    void dedupeKeysSeparateColonsAndEscapeCharacters() {
        assertNotEquals(FeedBatchService.spec("feed", "S:1", "test", "b1").dedupeKey(),
                FeedBatchService.spec("feed", "S", "test", "1:b1").dedupeKey());
        assertNotEquals(FeedBatchService.spec("feed", "S:1", "test", "b1").dedupeKey(),
                FeedBatchService.spec("feed", "S%3A1", "test", "b1").dedupeKey());
    }

    @Test
    void profileStoresNormalizedStagesAndRejectsAnAbsentArrivalStage() {
        FeedProfileService profiles = new FeedProfileService(feeds, null, audit);
        List<FeedProfile.StagePlan> stages = List.of(new FeedProfile.StagePlan(" preparation ", " ADDED "),
                new FeedProfile.StagePlan("closing", "FINISHED"));
        FeedProfile saved = profiles.save("test", "test", "test-feed", new FeedProfileRequest("Test", stages,
                "closing", null, List.of(), true));
        assertEquals("preparation", saved.stages().get(0).stageType());
        assertEquals("ADDED", saved.stages().get(0).serviceStatus());
        FeedProfileRequest invalid = new FeedProfileRequest("Test", stages, "transit", null, List.of(), true);
        assertThrows(IllegalArgumentException.class, () -> profiles.save("test", "test", "test-feed", invalid));
    }

    private static class TestTransactions implements Transactions {
        private int depth;
        private int outerTransactions;
        private Runnable onEnter;
        @Override
        public <T> T inTransaction(Supplier<T> work) {
            if (depth == 0) { outerTransactions++; }
            if (depth == 0 && onEnter != null) {
                Runnable action = onEnter;
                onEnter = null;
                action.run();
            }
            depth++;
            try {
                return work.get();
            } finally {
                depth--;
            }
        }
    }

    private class TestFeeds implements FeedStore {
        private FeedService saved;
        private boolean requireTransaction;
        private final FeedProfile profile = new FeedProfile("test", "test-feed", "Test feed",
                List.of(new FeedProfile.StagePlan("preparation", "ADDED"),
                        new FeedProfile.StagePlan("transit", "SCHEDULED"),
                        new FeedProfile.StagePlan("closing", "FINISHED")),
                "closing", null, Set.of(), true, null, "test", null, "test");
        public Optional<FeedProfile> profile(String tenant, String key) { return Optional.of(profile); }
        public List<FeedProfile> profiles(String tenant) { return List.of(profile); }
        public FeedProfile saveProfile(FeedProfile value) { return value; }
        public Optional<FeedService> service(String tenant, String key, String code) {
            if (requireTransaction) { assertTrue(tx.depth > 0, "stored payload must be read under the lock"); }
            return Optional.ofNullable(saved);
        }
        public FeedService lockService(String tenant, String key, String code) {
            if (saved == null) {
                saved = new FeedService(tenant, key, code, "{}", "", null, null, true, null, null, null);
            }
            return saved;
        }
        public void saveService(FeedService value) {
            assertTrue(tx.depth > 0, "outcomes must be saved before releasing the service lock");
            saved = value;
        }
        public List<FeedService> dueServices(OffsetDateTime now, int retryMinutes, int limit) {
            return openServices(limit);
        }
        public List<FeedService> openServices(int limit) { return saved == null ? List.of() : List.of(saved); }
    }
}

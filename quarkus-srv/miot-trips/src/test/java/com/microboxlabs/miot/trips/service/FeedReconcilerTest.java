package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import java.util.Map;
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
    private boolean monitorOwnsLifecycle;
    private final AuditService audit = new AuditService(world.auditStore, () -> this::monitorChange);
    private final TripLiveProjector live = world.projector(fleet);
    private final MandateService mandates = new MandateService(world.mandateStore, audit, tx);
    private final TripService trips = new TripService(world.tripStore, world.stageStore, world.assignmentStore,
            world.tripCargoStore, world.cargoStore, mandates, live, audit, tx);
    private final StageService stages = new StageService(world.stageStore, world.tripStore, world.tripCargoStore,
            mandates, live, audit, tx);
    private final AssignmentService assignments = new AssignmentService(world.assignmentStore, world.tripStore,
            fleet, live, audit, tx);
    private final ObjectMapper json = JsonMapper.builder().findAndAddModules().build();
    private final MilestoneService milestones = new MilestoneService(world.milestoneStore, world.tripStore, audit,
            tx);
    private final FeedReconciler reconciler = new FeedReconciler(feeds, mandates, trips, stages, assignments,
            new LocationService(world.locationStore, new com.microboxlabs.miot.trips.store.FakeGeofences(),
                    world.tripStore, live, audit, tx),
            milestones, audit, fleet, tx, json, Clock.systemUTC());

    private void monitorChange(String tenant, String actor, String action, String tripId,
            Map<String, Object> details) {
        if (monitorOwnsLifecycle && "trip.created".equals(action)) {
            stages.start(tenant, actor, UUID.fromString(stages.listByTrip(tenant, UUID.fromString(tripId)).get(0).id()));
        }
    }

    @Test
    void monitorOwnsLifecycleAcrossFeedCreationDepartureAndClosing() {
        monitorOwnsLifecycle = true;
        OffsetDateTime now = OffsetDateTime.now();
        FeedServiceRequest request = new FeedServiceRequest("service", "test reference", now.minusHours(1),
                now.plusHours(1), new FeedServiceRequest.Resources(null, null, List.of()), null);
        FeedResult result = send(request);
        assertEquals(FeedReconciler.CREATE, result.action());
        UUID tripId = UUID.fromString(result.tripId());
        assertEquals("preparation", stages.listByTrip("test", tripId).stream()
                .filter(s -> "in_progress".equals(s.status())).findFirst().orElseThrow().stageType());
        FeedServiceRequest ended = new FeedServiceRequest("service", "updated reference", now.minusHours(2),
                now.minusHours(1), request.resources(), null);
        assertEquals(FeedReconciler.UPDATE, send(ended).action());
        assertEquals("in_progress", trips.get("test", tripId).status());
        assertEquals("preparation", stages.listByTrip("test", tripId).stream()
                .filter(s -> "in_progress".equals(s.status())).findFirst().orElseThrow().stageType());
    }

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
    void sitesChangeTheHashOnlyWhenSent() throws Exception {
        FeedServiceRequest plain = desired(null, List.of());
        FeedServiceRequest.Site site = new FeedServiceRequest.Site("Av. Larco 101", "PE", "150122", null, null,
                null, null);
        FeedServiceRequest withSite = new FeedServiceRequest(plain.orderType(), plain.orderRef(), "CD-01", null,
                plain.plannedStart(), plain.plannedEnd(), null, null, null, plain.resources(), null, null, null,
                null, site, null);
        FeedServiceRequest withoutSite = new FeedServiceRequest(plain.orderType(), plain.orderRef(), "CD-01", null,
                plain.plannedStart(), plain.plannedEnd(), null, null, null, plain.resources(), null, null, null,
                null);

        assertFalse(json.writeValueAsString(withoutSite).contains("Site"));
        assertNotEquals(reconciler.hash(withoutSite), reconciler.hash(withSite));
        assertEquals(site, json.readValue(json.writeValueAsString(withSite), FeedServiceRequest.class).originSite());
    }

    @Test
    void recheckReadsTheStateOnlyAfterEnteringTheTransaction() throws Exception {
        send(desired(null, List.of()));
        FeedService previous = feeds.saved;
        String latest = json.writeValueAsString(desired(null, List.of()));
        tx.onEnter = () -> feeds.saved = new FeedService(previous.tenantCode(), previous.feedKey(),
                previous.externalCode(), latest, "new-hash", previous.mandateId(), previous.tripId(), true,
                previous.lastAction(), previous.lastResult(), previous.lastReconciledAt(), previous.appliedDesired());
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
    void reconciliationWatermarkUsesThePlanEvaluationTime() {
        java.time.Instant evaluated = java.time.Instant.parse("2026-01-01T12:00:00Z");
        Clock crossingClock = new Clock() {
            private int reads;
            public java.time.ZoneId getZone() { return java.time.ZoneOffset.UTC; }
            public Clock withZone(java.time.ZoneId zone) { return this; }
            public java.time.Instant instant() { return evaluated.plusSeconds(reads++ * 120L); }
        };
        FeedReconciler timed = new FeedReconciler(feeds, mandates, trips, stages, assignments,
            new LocationService(world.locationStore, new com.microboxlabs.miot.trips.store.FakeGeofences(),
                    world.tripStore, live, audit, tx),
                milestones, audit, fleet, tx, json, crossingClock);
        OffsetDateTime departure = OffsetDateTime.ofInstant(evaluated.plusSeconds(60), java.time.ZoneOffset.UTC);
        FeedServiceRequest request = new FeedServiceRequest("service", "test reference", departure,
                departure.plusHours(2), new FeedServiceRequest.Resources(null, null, List.of()), null);
        timed.reconcile("test", "test:actor", "test-feed", "S-TEST", request, false);
        assertEquals(evaluated, feeds.saved.lastReconciledAt().toInstant());
        assertTrue(feeds.saved.lastReconciledAt().isBefore(departure));
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
        FeedProfileService profiles = new FeedProfileService(feeds, audit);
        List<FeedProfile.StagePlan> stagePlan = List.of(new FeedProfile.StagePlan(" preparation ", " ADDED "),
                new FeedProfile.StagePlan("closing", "FINISHED"));
        FeedProfile saved = profiles.save("test", "test", "test-feed", new FeedProfileRequest("Test", null, stagePlan,
                "closing", List.of(), null, true));
        assertEquals("preparation", saved.stages().get(0).stageType());
        assertEquals("ADDED", saved.stages().get(0).serviceStatus());
        FeedProfileRequest invalid = new FeedProfileRequest("Test", null, stagePlan, "transit", List.of(), null, true);
        assertThrows(IllegalArgumentException.class, () -> profiles.save("test", "test", "test-feed", invalid));
        FeedProfileRequest nullResource = new FeedProfileRequest("Test", null, stagePlan, saved.arrivalStage(),
                java.util.Collections.singletonList(null), null, true);
        assertThrows(IllegalArgumentException.class,
                () -> profiles.save("test", "test", "test-feed", nullResource));
    }

    @Test
    void profileCountryIsOptionalUppercaseAndTwoAsciiLetters() {
        FeedProfileService profiles = new FeedProfileService(feeds, audit);
        var plan = List.of(new FeedProfile.StagePlan("transit", "SCHEDULED"));
        FeedProfile saved = profiles.save("test", "test", "test-feed",
                new FeedProfileRequest("Test", " cl ", plan, "transit", List.of(), null, true));
        assertEquals("CL", saved.country());
        assertEquals("CL", com.microboxlabs.miot.trips.dto.FeedProfileView.of(saved, 0).country());
        for (String country : List.of("C", "CHL", "C1", "12", "éé", "ıı")) {
            var request = new FeedProfileRequest("Test", country, plan, "transit", List.of(), null, true);
            assertThrows(IllegalArgumentException.class, () -> profiles.save("test", "test", "test-feed", request));
        }
        for (String country : java.util.Arrays.asList(null, "", " ")) {
            FeedProfile cleared = profiles.save("test", "test", "test-feed",
                    new FeedProfileRequest("Test", country, plan, "transit", List.of(), null, true));
            assertNull(cleared.country());
        }
    }

    @Test
    void feedJobsPassTheCountryAndKeepLocatedStatusInTheResult() {
        FeedProfile p = feeds.profile;
        new FeedProfileService(feeds, audit).save("test", "test", "test-feed", new FeedProfileRequest(
                p.name(), "CL", p.stages(), p.arrivalStage(), List.of(), false, true));
        FeedServiceRequest request = new FeedServiceRequest("service", "ref", "Av Providencia 1234", "SCL",
                OffsetDateTime.now().plusHours(2), OffsetDateTime.now().plusHours(5), null, null);
        send(request);
        FeedSites sites = new FeedSites(null, null) {
            @Override public List<String> locate(String organization, String tenant, String actor, String country,
                    FeedServiceRequest desired) {
                assertEquals("org-test", organization);
                assertEquals("test", tenant);
                assertEquals("feed:test-feed", actor);
                assertEquals("CL", country);
                assertEquals(request.origin(), desired.origin());
                return List.of("Av Providencia 1234: resolved");
            }
        };
        var handler = new FeedServiceJobHandler(reconciler, sites, json, feeds);
        var outcome = handler.handle("test", Map.of(FeedBatchService.FEED_KEY, "test-feed",
                FeedBatchService.EXTERNAL_CODE, "S-TEST", FeedBatchService.ORGANIZATION, "org-test"));
        assertEquals(List.of("Av Providencia 1234: resolved"), outcome.result().get("located"));
    }

    @Test
    void batchRetainsEveryRefusedItemEvenWithRepeatedOrIndexLikeCodes() {
        FeedBatchService batch = new FeedBatchService(reconciler, (tenant, feed, specs) -> {
            throw new IllegalStateException("test refusal");
        });
        var items = List.of("#1", "", "#1").stream()
                .map(code -> new com.microboxlabs.miot.trips.dto.FeedBatchRequest.Item(code, desired(null, List.of())))
                .toList();
        var result = batch.send("test", "test", "test-feed",
                new com.microboxlabs.miot.trips.dto.FeedBatchRequest("test-batch", items));
        assertEquals(List.of(0, 1, 2), result.refused().stream()
                .map(com.microboxlabs.miot.trips.dto.FeedBatchResult.Refusal::index).toList());
        assertEquals(List.of("#1", "", "#1"), result.refused().stream()
                .map(com.microboxlabs.miot.trips.dto.FeedBatchResult.Refusal::externalCode).toList());
    }

    @Test
    void aBatchSkipsAClosedUnchangedServiceWithoutATransaction() {
        FeedServiceRequest request = desired(null, List.of());
        feeds.saved = new FeedService("test", "test-feed", "S-1", "{}", reconciler.hash(request), null, null, false,
                FeedReconciler.SKIP, null, null, null);
        FeedBatchService batch = new FeedBatchService(reconciler, (tenant, feed, specs) -> {
            throw new AssertionError("nothing to queue");
        });
        int before = tx.outerTransactions;

        var result = batch.send("test", "test", "test-feed", new com.microboxlabs.miot.trips.dto.FeedBatchRequest(
                "test-batch", List.of(new com.microboxlabs.miot.trips.dto.FeedBatchRequest.Item("S-1", request))));

        assertEquals(List.of("S-1"), result.unchanged());
        assertEquals(before, tx.outerTransactions, "a settled service opens no transaction");
        assertFalse(reconciler.settled(new FeedService.Digest(reconciler.hash(request), FeedReconciler.SKIP, true),
                request), "an open service still goes through accept, which checks its trip");
        assertFalse(reconciler.settled(new FeedService.Digest(reconciler.hash(request), FeedReconciler.REPORT, false),
                request), "a reported service is resent");
    }

    @Test
    void aBatchAppliesTheLastStateWhenAnExternalCodeAppearsTwice() {
        FeedServiceRequest first = desired(null, List.of());
        FeedServiceRequest changed = new FeedServiceRequest(first.orderType(), "changed", first.plannedStart(),
                first.plannedEnd(), first.resources(), first.source());
        feeds.saved = new FeedService("test", "test-feed", "S-1", "{}", reconciler.hash(first), null, null, false,
                FeedReconciler.SKIP, null, null, null);
        FeedBatchService batch = new FeedBatchService(reconciler, (tenant, feed, specs) -> {});

        var result = batch.send("test", "test", "test-feed", new com.microboxlabs.miot.trips.dto.FeedBatchRequest(
                "test-batch", List.of(new com.microboxlabs.miot.trips.dto.FeedBatchRequest.Item("S-1", changed),
                        new com.microboxlabs.miot.trips.dto.FeedBatchRequest.Item("S-1", first))));

        assertEquals(List.of("S-1", "S-1"), result.queued());
        assertTrue(result.unchanged().isEmpty());
        assertEquals(reconciler.hash(first), feeds.saved.desiredHash());
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
        @Override
        public Map<String, Integer> openServices(String tenantCode) {
            return Map.of();
        }

        private FeedService saved;
        private boolean requireTransaction;
        private FeedProfile profile = new FeedProfile("test", "test-feed", "Test feed", null,
                List.of(new FeedProfile.StagePlan("preparation", "ADDED"),
                        new FeedProfile.StagePlan("transit", "SCHEDULED"),
                        new FeedProfile.StagePlan("closing", "FINISHED")),
                "closing", Set.of(), false, true, null, "test", null, "test");
        public Optional<FeedProfile> profile(String tenant, String key) { return Optional.of(profile); }
        public List<FeedProfile> profiles(String tenant) { return List.of(profile); }
        public FeedProfile saveProfile(FeedProfile value) { profile = value; return value; }
        public Optional<FeedProfile> createProfile(FeedProfile value) {
            throw new UnsupportedOperationException("not used by reconciler tests");
        }
        public Optional<FeedService> service(String tenant, String key, String code) {
            if (requireTransaction) { assertTrue(tx.depth > 0, "stored payload must be read under the lock"); }
            return Optional.ofNullable(saved);
        }
        public FeedService lockService(String tenant, String key, String code) {
            if (saved == null) {
                saved = new FeedService(tenant, key, code, "{}", "", null, null, true, null, null, null, null);
            }
            return saved;
        }
        public Map<String, FeedService.Digest> digests(String tenant, String key,
                java.util.Collection<String> codes) {
            return saved == null || !codes.contains(saved.externalCode()) ? Map.of() : Map.of(saved.externalCode(),
                    new FeedService.Digest(saved.desiredHash(), saved.lastAction(), saved.open()));
        }
        public void saveService(FeedService value) {
            assertTrue(tx.depth > 0, "outcomes must be saved before releasing the service lock");
            saved = value;
        }
    }
}

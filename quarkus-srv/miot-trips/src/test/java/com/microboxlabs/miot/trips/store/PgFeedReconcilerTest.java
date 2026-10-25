package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.fleet.resources.domain.Carrier;
import com.microboxlabs.miot.fleet.resources.domain.Driver;
import com.microboxlabs.miot.fleet.resources.domain.Trailer;
import com.microboxlabs.miot.fleet.resources.domain.Truck;
import com.microboxlabs.miot.fleet.resources.service.FleetResourcesService;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.FeedService;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.dto.AssignmentView;
import com.microboxlabs.miot.trips.dto.FeedBatchRequest;
import com.microboxlabs.miot.trips.dto.FeedBatchResult;
import com.microboxlabs.miot.trips.dto.FeedProfileRequest;
import com.microboxlabs.miot.trips.dto.FeedResult;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.dto.StageView;
import com.microboxlabs.miot.trips.dto.TripView;
import com.microboxlabs.miot.trips.service.AssignmentService;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.FeedBatchService;
import com.microboxlabs.miot.trips.service.FeedProfileService;
import com.microboxlabs.miot.trips.service.FeedReconciler;
import com.microboxlabs.miot.trips.service.FeedServiceJobHandler;
import com.microboxlabs.miot.trips.service.LocationService;
import com.microboxlabs.miot.trips.service.MandateService;
import com.microboxlabs.miot.trips.dto.MonitorRequest;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.service.MonitorService;
import com.microboxlabs.miot.trips.service.MonitorEngine;
import com.microboxlabs.miot.trips.service.StageService;
import com.microboxlabs.miot.trips.service.TripLiveProjector;
import com.microboxlabs.miot.trips.service.TripService;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The feed reconciler against a real database, through the real trips services: create, changes, the clock's
 * departure and close, repeats, reports, dry runs, and a failing step undoing the whole service. Skipped unless
 * {@code -Dmiot.trips.test.pg-url=…} is set.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgFeedReconcilerTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String FEED = "servicios";
    private static final String ACTOR = "feed:test";
    private static final ZoneOffset PE = ZoneOffset.ofHours(-5);

    private static Vertx vertx;
    private static Pool pool;

    private final MovableClock clock = new MovableClock(Instant.parse("2026-10-25T12:00:00Z"));
    private final ObjectMapper json = JsonMapper.builder().findAndAddModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).build();
    private final Transactions tx = new PgTransactions(() -> pool);
    private final MonitorEngine[] engineRef = new MonitorEngine[1];
    private final AuditService audit = new AuditService(new PgAuditStore(() -> pool), () -> engineRef[0]);
    private final MandateService mandates = new MandateService(new PgMandateStore(() -> pool), audit, tx);
    private final TripLiveProjector projector = PgTripsStoresTest.projector(() -> pool);
    private final TripService trips = new TripService(new PgTripStore(() -> pool), new PgStageStore(() -> pool),
            new PgAssignmentStore(() -> pool), new PgTripCargoStore(() -> pool), new PgCargoStore(() -> pool),
            mandates, projector, audit, tx);
    private final StageService stages = new StageService(new PgStageStore(() -> pool), new PgTripStore(() -> pool),
            new PgTripCargoStore(() -> pool), mandates, projector, audit, tx);
    private final com.microboxlabs.miot.fleet.resources.store.PgResourceStore resources =
            new com.microboxlabs.miot.fleet.resources.store.PgResourceStore(() -> pool);
    private final FleetResourcesService fleet = new FleetResourcesService(resources);
    private final AssignmentService assignments = new AssignmentService(new PgAssignmentStore(() -> pool),
            new PgTripStore(() -> pool), fleet, projector, audit, tx);
    private final PgFeedStore feeds = new PgFeedStore(() -> pool);
    private final FakeGeofences geofences = new FakeGeofences();
    private final LocationService locations = new LocationService(new PgLocationStore(() -> pool), geofences,
            new PgTripStore(() -> pool), projector, audit, tx);
    private final FeedReconciler reconciler = new FeedReconciler(feeds, mandates, trips, stages, assignments,
            locations, fleet, tx, json, clock);
    private final PgMonitorStore monitorStore = new PgMonitorStore(() -> pool);
    private final MonitorEngine engine = new MonitorEngine(new PgMonitorRunStore(() -> pool), monitorStore,
            new PgTripStore(() -> pool), new PgStageStore(() -> pool), new PgAssignmentStore(() -> pool),
            new PgLocationStore(() -> pool), stages, trips, mandates, fleet, audit, tx, clock);

    private String tenant;
    private Ids fleetIds;

    private record Ids(String abc, String ghi, String mno, String def, String d1, String d2, String d3) {
    }

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(
                PgTripsStoresTest.URL_PROPERTY))).using(vertx).build();
        PgTripsStoresTest.recreateSchemas(pool);
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    /** Each test: its own tenant with the feed profile and a small directory. */
    @BeforeEach
    void tenantWithAFeed() {
        engineRef[0] = engine;
        tenant = "t-" + UUID.randomUUID().toString().substring(0, 8);
        feeds.saveProfile(profile(List.of("preparation", "transit", "closing")));
        Carrier c = resources.insertCarrier(new Carrier(null, tenant, null, "20000000001", "Transportes Prueba SAC",
                null, null, null, null, null, Carrier.ACTIVE, false, null, null, null, ACTOR, null, ACTOR));
        fleetIds = new Ids(truck(c, "ABC-123", Carrier.ACTIVE), truck(c, "GHI-789", Carrier.ACTIVE),
                truck(c, "MNO-111", Carrier.ACTIVE), resources.insertTrailer(new Trailer(null, tenant, c.id(), null,
                        "DEF-456", null, null, null, Carrier.ACTIVE, false, null, null, null, ACTOR, null, ACTOR)).id(),
                driver(c, "10000001"), driver(c, "10000002"), driver(c, "10000003"));
        truck(c, "JKL-000", Carrier.INACTIVE);
    }

    private FeedProfile profile(List<String> stageTypes) {
        return new FeedProfile(tenant, FEED, "Servicios", stageTypes.stream()
                .map(t -> new FeedProfile.StagePlan(t, t.toUpperCase())).toList(), "closing", null,
                new LinkedHashSet<>(List.of("truck", "driver")), true, null, ACTOR, null, ACTOR);
    }

    private String truck(Carrier c, String plate, String status) {
        return resources.insertTruck(new Truck(null, tenant, c.id(), null, plate, null, null, null, null, status,
                false, null, null, null, ACTOR, null, ACTOR)).id();
    }

    private String driver(Carrier c, String document) {
        return resources.insertDriver(new Driver(null, tenant, c.id(), null, document, null, null, "Conductor",
                null, null, null, null, Carrier.ACTIVE, false, null, null, null, ACTOR, null, ACTOR)).id();
    }

    /** The desired state: departure and arrival in hours from the test clock, Peru time. */
    private FeedServiceRequest desired(double startH, double endH, String truck, String trailer, String... drivers) {
        return new FeedServiceRequest("directo", "Cliente Prueba · Carga general", at(startH), at(endH),
                new FeedServiceRequest.Resources(truck, trailer, List.of(drivers)), null);
    }

    private OffsetDateTime at(double hours) {
        return OffsetDateTime.ofInstant(clock.instant().plusSeconds((long) (hours * 3600)), PE);
    }

    private FeedResult send(String code, FeedServiceRequest d) {
        return reconciler.reconcile(tenant, ACTOR, FEED, code, d, false);
    }

    private TripView trip(FeedResult r) {
        return trips.detail(tenant, UUID.fromString(r.tripId()));
    }

    private static String status(TripView t, String stageType) {
        return t.stages().stream().filter(s -> s.stageType().equals(stageType)).map(StageView::status)
                .findFirst().orElseThrow();
    }

    private static List<String> openWindows(TripView t, String type) {
        return t.assignments().stream().filter(a -> a.validTo() == null && a.resourceType().equals(type))
                .map(AssignmentView::resourceId).sorted().toList();
    }

    @Test
    void aNewServiceIsCreatedWithItsResourcesAndItsPlanOnly() {
        FeedResult r = send("S-001", desired(2, 10, "abc 123", "DEF-456", "10000001"));

        assertEquals(FeedReconciler.CREATE, r.action());
        assertTrue(r.errors().isEmpty());
        TripView t = trip(r);
        assertEquals(Trip.PLANNED, t.status(), "without a monitor nothing starts it");
        assertEquals(Stage.PENDING, status(t, "preparation"));
        assertEquals(Stage.PENDING, status(t, "transit"));
        assertEquals(List.of(fleetIds.abc()), openWindows(t, "truck"));
        assertEquals(List.of(fleetIds.def()), openWindows(t, "trailer"));
        assertEquals(List.of(fleetIds.d1()), openWindows(t, "driver"));
        assertNotNull(t.stages().stream().filter(s -> s.stageType().equals("closing")).findFirst().orElseThrow()
                .plannedEnd(), "the arrival stage carries the arrival time");
        FeedService s = feeds.service(tenant, FEED, "S-001").orElseThrow();
        assertEquals(reconciler.hash(desired(2, 10, "abc 123", "DEF-456", "10000001")), s.desiredHash());
        assertTrue(s.open());
    }

    private FeedServiceRequest routed(String origin, String destination) {
        FeedServiceRequest d = desired(2, 10, "ABC-123", null, "10000001");
        return new FeedServiceRequest(d.orderType(), d.orderRef(), origin, destination, d.plannedStart(),
                d.plannedEnd(), d.resources(), null);
    }

    @Test
    void placesAreMatchedByTheirNameAsSentAndCreatedWhenMissing() {
        FeedResult dry = reconciler.reconcile(tenant, ACTOR, FEED, "S-010", routed("Terminal Norte", "Planta Sur"),
                true);
        assertTrue(dry.operations().contains("create location Terminal Norte"), dry.operations().toString());
        assertTrue(locations.byCode(tenant, "Terminal Norte").isEmpty(), "a dry run creates nothing");

        FeedResult r = send("S-010", routed("Terminal Norte", "Planta Sur"));
        TripView t = trip(r);
        var origin = locations.byCode(tenant, "Terminal Norte").orElseThrow();
        var destination = locations.byCode(tenant, "Planta Sur").orElseThrow();
        assertEquals(LocationService.FEED_TYPE, origin.type());
        assertEquals(origin.id(), t.originId());
        assertEquals(destination.id(), t.destinationId());
        assertEquals(origin.id(), mandates.get(tenant, UUID.fromString(r.mandateId())).originId());
        assertTrue(r.warnings().contains("location Planta Sur has no GPS geofence"), r.warnings().toString());
        assertTrue(locations.byCode(tenant, "planta sur").isEmpty(), "names are compared as sent");

        geofences.add(tenant, 42, "PS", "Planta Sur");
        locations.linkGeofence(tenant, ACTOR, UUID.fromString(destination.id()), 42);
        var live = new PgTripLiveStore(() -> pool).find(tenant, UUID.fromString(t.id())).orElseThrow();
        assertEquals(42, live.destinationGeofenceId());
        assertEquals("Planta Sur", live.destinationGeofenceLabel());

        FeedResult moved = send("S-010", routed("Terminal Norte", "Puerto Centro"));
        assertTrue(moved.operations().contains("change route"), moved.operations().toString());
        assertEquals(locations.byCode(tenant, "Puerto Centro").orElseThrow().id(), trip(moved).destinationId());
        assertEquals(origin.id(), trip(moved).originId());
        assertTrue(moved.warnings().contains("location Puerto Centro has no GPS geofence"));
        assertNull(new PgTripLiveStore(() -> pool).find(tenant, UUID.fromString(t.id())).orElseThrow()
                .destinationGeofenceId());

        assertThrows(IllegalArgumentException.class,
                () -> locations.linkGeofence(tenant, ACTOR, UUID.fromString(origin.id()), 7),
                "a geofence of another client is refused");
    }

    @Test
    void aServiceWhoseDepartureTimePassedIsCreatedAsPlannedWithBothDrivers() {
        FeedResult r = send("S-002", desired(-1, 5, "GHI 789", "DEF-456", "10000002", "10000003"));

        TripView t = trip(r);
        assertEquals(Stage.PENDING, status(t, "preparation"), "the feed does not move stages by time");
        assertEquals(List.of(fleetIds.d2(), fleetIds.d3()).stream().sorted().toList(), openWindows(t, "driver"));
    }

    @Test
    void theProfilesMonitorRunsTheTripsTheFeedCreates() {
        MonitorService monitors = new MonitorService(monitorStore, audit, tx);
        monitors.saveDraft(tenant, ACTOR, "direct", new MonitorRequest("Direct", null, List.of(), Map.of(), List.of(
                new MonitorRequest.Rule("open", null, "plan", null, "event.kind == 'created'",
                        List.of(new TripMonitor.Action("start", "preparation")), 10, true))));
        monitors.publish(tenant, ACTOR, "direct");
        FeedProfileService profiles = new FeedProfileService(feeds, monitorStore, audit);
        profiles.save(tenant, ACTOR, FEED, new FeedProfileRequest("Servicios", List.of(
                new FeedProfile.StagePlan("preparation", "ADDED"), new FeedProfile.StagePlan("closing", "FINISHED")),
                "closing", "direct", null, null));

        FeedResult r = send("S-020", desired(2, 10, "ABC-123", null, "10000001"));

        assertEquals("direct", engine.state(tenant, UUID.fromString(r.tripId())).orElseThrow().monitorKey());
        assertEquals(Stage.RUNNING, status(trip(r), "preparation"), "the monitor's plan rule opened it");
    }

    @Test
    void aServiceWithoutItsRequiredResourcesIsReportedAndNothingIsCreated() {
        FeedResult inactive = send("S-005", desired(1, 6, "JKL-000", null, "10000005"));
        FeedResult incomplete = send("S-003", desired(1, 6, "PQR-222", null));

        assertEquals(FeedReconciler.REPORT, inactive.action());
        assertEquals(List.of("truck JKL-000 is inactive", "driver 10000005 is not in the fleet directory"),
                inactive.errors());
        assertEquals(List.of("truck PQR-222 is not in the fleet directory", "driver is required"),
                incomplete.errors());
        assertTrue(mandates.list(tenant, null, "S-005", 0, 10).isEmpty(), "no mandate for a reported service");
        assertTrue(feeds.service(tenant, FEED, "S-005").orElseThrow().open(), "the next send retries it");
    }

    @Test
    void aMissingTrailerIsAWarningNotAStop() {
        FeedResult r = send("S-006", desired(1, 6, "ABC-123", "ZZZ-999", "10000001"));

        assertEquals(FeedReconciler.CREATE, r.action());
        assertEquals(List.of("trailer ZZZ-999 is not in the fleet directory"), r.warnings());
        assertTrue(openWindows(trip(r), "trailer").isEmpty());
    }

    @Test
    void aServiceWhoseArrivalTimeAlreadyPassedIsNotCreated() {
        FeedResult r = send("S-004", desired(-12, -5, "ABC-123", null, "10000001"));

        assertEquals(FeedReconciler.SKIP, r.action());
        assertNull(r.tripId());
        assertFalse(feeds.service(tenant, FEED, "S-004").orElseThrow().open());
    }

    @Test
    void changesMoveTheTimesSwapTheTruckAndDropTheSecondDriver() {
        send("S-001", desired(2, 10, "ABC-123", "DEF-456", "10000001", "10000002"));
        FeedServiceRequest changed = new FeedServiceRequest("directo", "Cliente Nuevo · Carga general", at(3), at(12),
                new FeedServiceRequest.Resources("MNO-111", "DEF-456", List.of("10000001")), null);

        FeedResult r = send("S-001", changed);

        assertEquals(FeedReconciler.UPDATE, r.action());
        assertEquals(List.of("change planned start", "change planned end", "change order reference",
                "end truck window", "assign truck MNO-111", "end driver window"), r.operations());
        TripView t = trip(r);
        assertEquals(List.of(fleetIds.mno()), openWindows(t, "truck"));
        assertEquals(List.of(fleetIds.d1()), openWindows(t, "driver"));
        assertEquals(at(3).toInstant(), t.plannedStart().toInstant());
        assertEquals("Cliente Nuevo · Carga general", mandates.get(tenant, UUID.fromString(r.mandateId())).orderRef());
    }

    @Test
    void sendingTheSameStateAgainChangesNothing() {
        FeedServiceRequest d = desired(2, 10, "ABC-123", "DEF-456", "10000001");
        send("S-001", d);

        FeedResult again = send("S-001", d);

        assertEquals(FeedReconciler.UPDATE, again.action());
        assertEquals(List.of(), again.operations());
    }

    @Test
    void timePassingMovesNothingAndARealizedTripIsSkipped() {
        FeedResult created = send("S-001", desired(2, 10, "ABC-123", "DEF-456", "10000001"));

        clock.advance(Duration.ofHours(13));
        FeedResult later = reconciler.recheck(tenant, ACTOR, FEED, "S-001");
        assertEquals(FeedReconciler.UPDATE, later.action());
        assertEquals(List.of(), later.operations(), "departure and close are the monitor's");
        assertEquals(Trip.PLANNED, trip(created).status());

        UUID tripId = UUID.fromString(created.tripId());
        trip(created).stages().forEach(st -> {
            stages.start(tenant, ACTOR, UUID.fromString(st.id()));
            stages.close(tenant, ACTOR, UUID.fromString(st.id()));
        });
        assertEquals(Trip.DONE, trips.get(tenant, tripId).status());
        assertEquals(FeedReconciler.SKIP, reconciler.recheck(tenant, ACTOR, FEED, "S-001").action());
        assertFalse(feeds.service(tenant, FEED, "S-001").orElseThrow().open(), "a realized trip closes the service");
    }

    @Test
    void aDryRunSaysWhatItWouldDoAndWritesNothing() {
        FeedResult r = reconciler.reconcile(tenant, ACTOR, FEED, "S-009", desired(-1, 5, "ABC-123", null,
                "10000001"), true);

        assertTrue(r.dryRun());
        assertEquals(List.of("create mandate S-009", "create trip with stages [preparation, transit, closing]",
                "assign truck ABC-123", "assign driver 10000001"), r.operations());
        assertTrue(mandates.list(tenant, null, "S-009", 0, 10).isEmpty());
        assertTrue(feeds.service(tenant, FEED, "S-009").isEmpty());
    }

    @Test
    void aFailingStepUndoesTheWholeServiceAndIsRecorded() {
        feeds.saveProfile(profile(List.of("preparation", "volando", "closing")));

        FeedServiceRequest request = desired(1, 6, "ABC-123", null, "10000001");
        assertThrows(IllegalArgumentException.class, () -> send("S-010", request));

        assertTrue(mandates.list(tenant, null, "S-010", 0, 10).isEmpty(), "the mandate created first is undone");
        FeedService s = feeds.service(tenant, FEED, "S-010").orElseThrow();
        assertEquals(FeedReconciler.ERROR, s.lastAction());
        assertEquals("", s.desiredHash(), "no hash: the next send is applied, not skipped");
        assertTrue(s.lastResult().contains("stageType"));
    }

    @Test
    void anUnknownOrSwitchedOffFeedIsNotFound() {
        assertThrows(java.util.NoSuchElementException.class, () -> reconciler.reconcile(tenant, ACTOR, "otro",
                "S-1", desired(1, 2, "ABC-123", null, "10000001"), true));
    }

    @Test
    void aBatchQueuesOnlyChangedServicesAndTheJobAppliesTheLatestState() {
        List<AsyncJobSpec> queued = new ArrayList<>();
        FeedBatchService batches = new FeedBatchService(reconciler, (t, f, specs) -> queued.addAll(specs));
        FeedServiceJobHandler handler = new FeedServiceJobHandler(reconciler, json);
        FeedBatchRequest first = new FeedBatchRequest("b1", List.of(
                new FeedBatchRequest.Item("S-001", desired(2, 10, "ABC-123", "DEF-456", "10000001")),
                new FeedBatchRequest.Item(" ", desired(2, 10, "ABC-123", null, "10000001"))));

        FeedBatchResult r1 = batches.send(tenant, ACTOR, FEED, first);
        assertEquals(List.of("S-001"), r1.queued());
        assertEquals(List.of(""), List.copyOf(r1.refused().keySet()), "a blank code is refused, not queued");
        assertEquals("trips-feed:" + FEED + ":S-001:b1", queued.get(0).dedupeKey());
        assertEquals(FeedReconciler.PENDING, feeds.service(tenant, FEED, "S-001").orElseThrow().lastAction());

        JobOutcome done = handler.handle(tenant, queued.get(0).payload());
        assertEquals(JobOutcome.SUCCEEDED, done.outcome());
        assertEquals(FeedReconciler.CREATE, done.result().get("action"));

        FeedBatchResult again = batches.send(tenant, ACTOR, FEED, new FeedBatchRequest("b2", first.services()
                .subList(0, 1)));
        assertEquals(List.of("S-001"), again.unchanged());
        assertEquals(1, queued.size(), "an unchanged service queues nothing");
    }

    @Test
    void aJobForAServiceThatCannotBeCreatedFailsWithoutRetry() {
        List<AsyncJobSpec> queued = new ArrayList<>();
        FeedBatchService batches = new FeedBatchService(reconciler, (t, f, specs) -> queued.addAll(specs));
        FeedServiceJobHandler handler = new FeedServiceJobHandler(reconciler, json);
        batches.send(tenant, ACTOR, FEED, new FeedBatchRequest(null, List.of(
                new FeedBatchRequest.Item("S-005", desired(1, 6, "JKL-000", null, "10000001")))));

        NonRetryableJobException e = assertThrows(NonRetryableJobException.class,
                () -> handler.handle(tenant, queued.get(0).payload()));
        assertEquals("truck JKL-000 is inactive", e.getMessage());
    }

    @Test
    void aFeedProfileIsCheckedBeforeItIsSaved() {
        FeedProfileService profiles = new FeedProfileService(feeds, monitorStore, audit);
        List<FeedProfile.StagePlan> plan = List.of(new FeedProfile.StagePlan("preparation", "ADDED"),
                new FeedProfile.StagePlan("closing", "FINISHED"));

        FeedProfileRequest missingArrival = new FeedProfileRequest("Nuevo", plan, "transit", null, null, null);
        assertThrows(IllegalArgumentException.class, () -> profiles.save(tenant, ACTOR, "nuevo", missingArrival),
                "the arrival stage must be in the plan");
        FeedProfileRequest unknownMonitor = new FeedProfileRequest("Nuevo", plan, "closing", "unknown", null, null);
        assertThrows(IllegalArgumentException.class, () -> profiles.save(tenant, ACTOR, "nuevo", unknownMonitor),
                "the monitor must have a published version");
        FeedProfileRequest valid = new FeedProfileRequest("Nuevo", plan, "closing", null, null, null);
        assertThrows(IllegalArgumentException.class, () -> profiles.save(tenant, ACTOR, "Con Mayusculas", valid));
        FeedProfile saved = profiles.save(tenant, ACTOR, "nuevo",
                new FeedProfileRequest("Nuevo", plan, "closing", null, List.of("truck"), null));
        assertNull(saved.monitor(), "no monitor: the selector picks one");
        assertTrue(saved.active());
    }

    /** A clock the test moves forward. */
    private static final class MovableClock extends Clock {
        private Instant now;

        MovableClock(Instant start) {
            this.now = start;
        }

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}

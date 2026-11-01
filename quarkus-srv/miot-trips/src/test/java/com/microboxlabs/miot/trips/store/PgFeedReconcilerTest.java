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
import com.microboxlabs.miot.trips.domain.MonitorScope;
import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.BoardRow;
import com.microboxlabs.miot.trips.domain.FeedService;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.dto.MonitorViews;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.dto.AssignmentView;
import com.microboxlabs.miot.trips.dto.FeedBatchRequest;
import com.microboxlabs.miot.trips.dto.FeedBatchResult;
import com.microboxlabs.miot.trips.dto.FeedProfileRequest;
import com.microboxlabs.miot.trips.dto.FeedResult;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.dto.StageView;
import com.microboxlabs.miot.trips.dto.TripView;
import com.microboxlabs.miot.trips.service.MilestoneService;
import com.microboxlabs.miot.trips.service.AssignmentService;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.CargoService;
import com.microboxlabs.miot.trips.service.TripCargoService;
import com.microboxlabs.miot.trips.service.FeedBatchService;
import com.microboxlabs.miot.trips.service.FeedProfileService;
import com.microboxlabs.miot.trips.service.FeedReconciler;
import com.microboxlabs.miot.trips.service.FeedServiceJobHandler;
import com.microboxlabs.miot.trips.service.FeedSites;
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
import io.vertx.mutiny.sqlclient.Tuple;
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
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
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
    private final FleetResourcesService fleet = new FleetResourcesService(resources, tx);
    private final AssignmentService assignments = new AssignmentService(new PgAssignmentStore(() -> pool),
            new PgTripStore(() -> pool), fleet, projector, audit, tx);
    private final PgFeedStore feeds = new PgFeedStore(() -> pool);
    private final FakeGeofences geofences = new FakeGeofences();
    private final LocationService locations = new LocationService(new PgLocationStore(() -> pool), geofences,
            new PgTripStore(() -> pool), projector, audit, tx);
    private final MilestoneService milestones = new MilestoneService(new PgMilestoneStore(() -> pool),
            new PgTripStore(() -> pool), audit, tx);
    private final FeedReconciler reconciler = new FeedReconciler(feeds, mandates, trips, stages, assignments,
            locations, milestones, audit, fleet, tx, json, clock);
    private final CargoService cargoUnits = new CargoService(new PgCargoStore(() -> pool), mandates, projector,
            audit, tx);
    private final FeedReconciler withCargo = new FeedReconciler(feeds, mandates, trips, stages, assignments,
            locations, milestones, audit, fleet, tx, json, clock, cargoUnits,
            new TripCargoService(new PgTripCargoStore(() -> pool), new PgTripStore(() -> pool),
                    new PgCargoStore(() -> pool), new PgStageStore(() -> pool), mandates, projector, audit, tx));
    private final PgMonitorStore monitorStore = new PgMonitorStore(() -> pool);
    private final MonitorEngine engine = new MonitorEngine(new PgMonitorRunStore(() -> pool), monitorStore,
            new PgTripStore(() -> pool), new PgStageStore(() -> pool), new PgAssignmentStore(() -> pool),
            new PgLocationStore(() -> pool), stages, trips, mandates, milestones, fleet, audit, tx, clock);

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
        return new FeedProfile(tenant, FEED, "Servicios", null, stageTypes.stream()
                .map(t -> new FeedProfile.StagePlan(t, t.toUpperCase())).toList(), "closing",
                new LinkedHashSet<>(List.of("truck", "driver")), false, true, null, ACTOR, null, ACTOR);
    }

    @Test
    void creatingAFeedCannotOverwriteAnExistingProfile() {
        FeedProfileService profiles = new FeedProfileService(feeds, audit);
        FeedProfileRequest original = new FeedProfileRequest("Original", null, List.of(
                new FeedProfile.StagePlan("preparation", "READY")), "preparation", List.of("truck"), null, true);
        profiles.createView(tenant, ACTOR, "create-key", original);
        FeedProfile before = feeds.profile(tenant, "create-key").orElseThrow();
        FeedProfileRequest replacement = new FeedProfileRequest("Replacement", null, List.of(
                new FeedProfile.StagePlan("closing", "CLOSED")), "closing", List.of(), null, false);

        assertThrows(IllegalStateException.class,
                () -> profiles.createView(tenant, ACTOR, "create-key", replacement));

        assertEquals(before, feeds.profile(tenant, "create-key").orElseThrow(),
                "a stale creation attempt must preserve every existing rule and audit field");
    }

    @Test
    void onlyOneConcurrentCreatorCanClaimAFeedKey() throws Exception {
        FeedProfile first = new FeedProfile(tenant, "racing-feed", "First", null, List.of(
                new FeedProfile.StagePlan("preparation", null)), "preparation", Set.of(), true, true,
                null, ACTOR, null, ACTOR);
        FeedProfile second = new FeedProfile(tenant, first.feedKey(), "Second", null, first.stages(), first.arrivalStage(),
                first.requiredResources(), true, true, null, ACTOR, null, ACTOR);
        var a = CompletableFuture.supplyAsync(() -> feeds.createProfile(first));
        var b = CompletableFuture.supplyAsync(() -> feeds.createProfile(second));
        List<Optional<FeedProfile>> outcomes = List.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS));

        assertEquals(1L, outcomes.stream().filter(Optional::isPresent).count());
        String winner = outcomes.stream().flatMap(Optional::stream).findFirst().orElseThrow().name();
        assertEquals(winner, feeds.profile(tenant, first.feedKey()).orElseThrow().name());
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

        UUID originId = UUID.fromString(origin.id());
        assertThrows(IllegalArgumentException.class,
                () -> locations.linkGeofence(tenant, ACTOR, originId, 7),
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
    void aFeedScopedMonitorRunsTheTripsTheFeedCreates() {
        MonitorService monitors = new MonitorService(monitorStore, null, null, audit, tx);
        monitors.saveDraft(tenant, ACTOR, "direct", new MonitorRequest("Direct", null, List.of(), Map.of(), List.of(
                new MonitorRequest.Rule("open", null, "plan", null, "event.kind == 'created'",
                        List.of(new TripMonitor.Action("start", "preparation")), 10, true)),
                new MonitorScope(List.of(FEED), List.of(), List.of(), List.of())));
        monitors.publish(tenant, ACTOR, "direct");
        FeedProfileService profiles = new FeedProfileService(feeds, audit);
        profiles.save(tenant, ACTOR, FEED, new FeedProfileRequest("Servicios", null, List.of(
                new FeedProfile.StagePlan("preparation", "ADDED"), new FeedProfile.StagePlan("closing", "FINISHED")),
                "closing", null, null, null));

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
    void anUnknownFeedIsNotFoundAndASwitchedOffOneIsAConflict() {
        FeedServiceRequest request = desired(1, 2, "ABC-123", null, "10000001");
        assertThrows(java.util.NoSuchElementException.class, () -> reconciler.reconcile(tenant, ACTOR, "otro",
                "S-1", request, true));
        FeedProfile on = feeds.profile(tenant, FEED).orElseThrow();
        feeds.saveProfile(new FeedProfile(tenant, FEED, on.name(), null, on.stages(), on.arrivalStage(),
                on.requiredResources(), true, false, null, ACTOR, null, ACTOR));
        IllegalStateException off = assertThrows(IllegalStateException.class, () -> reconciler.reconcile(tenant,
                ACTOR, FEED, "S-1", request, true));
        assertEquals("feed " + FEED + " is inactive", off.getMessage());
    }

    @Test
    void eachFeedCountsItsOpenServices() {
        assertEquals(Map.of(), feeds.openServices(tenant));
        send("S-040", desired(1, 6, "ABC-123", null, "10000001"));
        send("S-041", desired(2, 7, "ABC-123", null, "10000001"));
        assertEquals(Map.of(FEED, 2), feeds.openServices(tenant));
    }

    @Test
    void inverseRoutesCreateLocationsInTheSameOrder() {
        FeedServiceRequest base = desired(1, 6, "ABC-123", null, "10000001");
        for (List<String> route : List.of(List.of("TEST-A", "TEST-B"), List.of("TEST-B", "TEST-A"))) {
            FeedServiceRequest request = new FeedServiceRequest(base.orderType(), base.orderRef(),
                    route.get(0), route.get(1), base.plannedStart(), base.plannedEnd(), base.resources(), null);
            FeedResult result = reconciler.reconcile(tenant, ACTOR, FEED, "TEST-ROUTE", request, true);
            assertEquals(List.of("create location TEST-A", "create location TEST-B"), result.operations().stream()
                    .filter(operation -> operation.startsWith("create location ")).toList());
        }
    }

    @Test
    void descriptiveEditsAndGeofenceLinksDoNotOverwriteEachOther() {
        var created = locations.resolve(tenant, ACTOR, "TEST-LOCATION");
        PgLocationStore store = new PgLocationStore(() -> pool);
        UUID locationId = UUID.fromString(created.id());
        geofences.add(tenant, 42, "TEST-FENCE", "Test geofence");
        locations.linkGeofence(tenant, ACTOR, locationId, 42);
        var staleRename = new com.microboxlabs.miot.trips.domain.Location(created.id(), tenant, "Renamed test location",
                created.type(), created.externalCode(), created.geomGeojson(), null,
                created.createdAt(), created.createdBy(), null, ACTOR);
        assertEquals(42, store.update(staleRename).orElseThrow().geofenceId());
        assertEquals("Renamed test location", locations.linkGeofence(tenant, ACTOR, locationId, null).name());
        assertNull(store.find(tenant, locationId).orElseThrow().geofenceId());
    }

    @Test
    void aBatchQueuesOnlyChangedServicesAndTheJobAppliesTheLatestState() {
        List<AsyncJobSpec> queued = new ArrayList<>();
        FeedBatchService batches = new FeedBatchService(reconciler, (t, f, specs) -> queued.addAll(specs));
        FeedServiceJobHandler handler = new FeedServiceJobHandler(reconciler, new FeedSites(null, null), json, feeds);
        FeedBatchRequest first = new FeedBatchRequest("b1", List.of(
                new FeedBatchRequest.Item("S-001", desired(2, 10, "ABC-123", "DEF-456", "10000001")),
                new FeedBatchRequest.Item(" ", desired(2, 10, "ABC-123", null, "10000001")),
                new FeedBatchRequest.Item("S-\0BAD", desired(2, 10, "ABC-123", null, "10000001")),
                new FeedBatchRequest.Item("\0S-TAIL", desired(2, 10, "ABC-123", null, "10000001"))));

        FeedBatchResult r1 = batches.send(tenant, ACTOR, FEED, first);
        assertEquals(List.of("S-001"), r1.queued());
        assertEquals(List.of("", "S-\0BAD", "S-TAIL"), r1.refused().stream()
                .map(FeedBatchResult.Refusal::externalCode).toList(),
                "invalid codes are refused without failing the batch");
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
    void unchangedBatchesCloseTerminalServicesWithoutQueuingJobs() {
        List<AsyncJobSpec> queued = new ArrayList<>();
        FeedBatchService batches = new FeedBatchService(reconciler, (t, f, specs) -> queued.addAll(specs));
        for (boolean cancelled : List.of(false, true)) {
            String code = cancelled ? "TEST-CANCELLED" : "TEST-COMPLETED";
            FeedServiceRequest desired = desired(2, 10, "ABC-123", "DEF-456", "10000001");
            FeedResult created = send(code, desired);
            UUID tripId = UUID.fromString(created.tripId());
            if (cancelled) {
                trips.cancel(tenant, ACTOR, tripId, "test cancellation");
            } else {
                var closing = trips.detail(tenant, tripId).stages().stream()
                        .filter(stage -> "closing".equals(stage.stageType())).findFirst().orElseThrow();
                stages.start(tenant, ACTOR, UUID.fromString(closing.id()));
                stages.close(tenant, ACTOR, UUID.fromString(closing.id()));
            }
            assertTrue(feeds.service(tenant, FEED, code).orElseThrow().open());
            FeedBatchResult result = batches.send(tenant, ACTOR, FEED,
                    new FeedBatchRequest("test-repeat", List.of(new FeedBatchRequest.Item(code, desired))));
            assertEquals(List.of(code), result.unchanged());
            assertTrue(result.refused().isEmpty());
            assertFalse(feeds.service(tenant, FEED, code).orElseThrow().open());
            assertEquals(FeedReconciler.SKIP, feeds.service(tenant, FEED, code).orElseThrow().lastAction());

            var digests = feeds.digests(tenant, FEED, List.of(code, "TEST-MISSING"));
            assertEquals(new FeedService.Digest(feeds.service(tenant, FEED, code).orElseThrow().desiredHash(),
                    FeedReconciler.SKIP, false), digests.get(code));
            assertFalse(digests.containsKey("TEST-MISSING"));
            FeedBatchResult settled = batches.send(tenant, ACTOR, FEED,
                    new FeedBatchRequest("test-settled", List.of(new FeedBatchRequest.Item(code, desired))));
            assertEquals(List.of(code), settled.unchanged(), "a closed, unchanged service is skipped from the digest");
        }
        assertTrue(queued.isEmpty());
    }

    @Test
    void aJobForAServiceThatCannotBeCreatedFailsWithoutRetry() {
        List<AsyncJobSpec> queued = new ArrayList<>();
        FeedBatchService batches = new FeedBatchService(reconciler, (t, f, specs) -> queued.addAll(specs));
        FeedServiceJobHandler handler = new FeedServiceJobHandler(reconciler, new FeedSites(null, null), json, feeds);
        batches.send(tenant, ACTOR, FEED, new FeedBatchRequest(null, List.of(
                new FeedBatchRequest.Item("S-005", desired(1, 6, "JKL-000", null, "10000001")))));

        NonRetryableJobException e = assertThrows(NonRetryableJobException.class,
                () -> handler.handle(tenant, queued.get(0).payload()));
        assertEquals("truck JKL-000 is inactive", e.getMessage());
    }

    @Test
    void aFeedProfileIsCheckedBeforeItIsSaved() {
        FeedProfileService profiles = new FeedProfileService(feeds, audit);
        List<FeedProfile.StagePlan> plan = List.of(new FeedProfile.StagePlan("preparation", "ADDED"),
                new FeedProfile.StagePlan("closing", "FINISHED"));

        FeedProfileRequest missingArrival = new FeedProfileRequest("Nuevo", null, plan, "transit", null, null, null);
        assertThrows(IllegalArgumentException.class, () -> profiles.save(tenant, ACTOR, "nuevo", missingArrival),
                "the arrival stage must be in the plan");
        FeedProfileRequest valid = new FeedProfileRequest("Nuevo", null, plan, "closing", null, null, null);
        assertThrows(IllegalArgumentException.class, () -> profiles.save(tenant, ACTOR, "Con Mayusculas", valid));
        FeedProfile saved = profiles.save(tenant, ACTOR, "nuevo",
                new FeedProfileRequest("Nuevo", null, plan, "closing", List.of("truck"), null, null));
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

    private FeedServiceRequest withActuals(FeedServiceRequest d, OffsetDateTime start, OffsetDateTime arrival,
            OffsetDateTime end) {
        return new FeedServiceRequest(d.orderType(), d.orderRef(), d.origin(), d.destination(), d.plannedStart(),
                d.plannedEnd(), start, arrival, end, d.resources(), null);
    }

    private FeedServiceRequest withReports(FeedServiceRequest d,
            Map<String, FeedServiceRequest.MilestoneReport> reports) {
        return new FeedServiceRequest(d.orderType(), d.orderRef(), d.origin(), d.destination(), d.plannedStart(),
                d.plannedEnd(), d.actualStart(), d.actualArrival(), d.actualEnd(), d.resources(), null, reports);
    }

    private TripMilestone milestone(String tripId, String name) {
        return milestones.list(tenant, UUID.fromString(tripId)).stream().filter(m -> m.milestone().equals(name))
                .findFirst().orElseThrow();
    }

    @Test
    void aRowReportsMilestonesWithTheirMetadata() {
        FeedServiceRequest d = desired(1, 5, "ABC-123", null, "10000001");
        FeedServiceRequest reported = new FeedServiceRequest(d.orderType(), d.orderRef(), d.origin(),
                d.destination(), d.plannedStart(), d.plannedEnd(), null, null, null, d.resources(), null, Map.of(
                        "presentation", new FeedServiceRequest.MilestoneReport(at(-0.2), Map.of("gate", "G3")),
                        "validation", new FeedServiceRequest.MilestoneReport(null, Map.of("documents", "ok"))));
        FeedResult r = send("S-040", reported);
        assertEquals(List.of(), r.errors());

        TripMilestone presentation = milestone(r.tripId(), TripMilestone.PRESENTATION);
        assertEquals(TripMilestone.CONFIRMED, presentation.status());
        assertEquals(Map.of("gate", "G3"), presentation.evidence());
        TripMilestone validation = milestone(r.tripId(), TripMilestone.VALIDATION);
        assertEquals(TripMilestone.PENDING, validation.status(), "without a time the milestone waits");
        assertEquals("feed", validation.source());
        assertEquals(Map.of("documents", "ok"), validation.evidence());

        assertEquals(List.of(), send("S-040", reported).operations(), "the same row applies nothing again");
        assertEquals(reconciler.hash(d), reconciler.hash(new FeedServiceRequest(d.orderType(), d.orderRef(),
                d.origin(), d.destination(), d.plannedStart(), d.plannedEnd(), null, null, null, d.resources(), null,
                Map.of())), "a row without reports keeps the hash it had");
        FeedServiceRequest invalid = new FeedServiceRequest(d.orderType(),
                d.orderRef(), null, null, d.plannedStart(), d.plannedEnd(), null, null, null, d.resources(), null,
                Map.of("unloading", new FeedServiceRequest.MilestoneReport(null, Map.of())));
        assertThrows(IllegalArgumentException.class, () -> send("S-041", invalid));
    }

    @Test
    void reportedMilestonesRunInTripOrderAndRulesReadTheirEvidence() {
        MonitorService monitors = new MonitorService(monitorStore, null, null, audit, tx);
        monitors.saveDraft(tenant, ACTOR, "reports", new MonitorRequest("Reports", null, List.of(), Map.of(), List.of(
                new MonitorRequest.Rule("open", null, "plan", null, "event.kind == 'created'",
                        List.of(new TripMonitor.Action("start", "preparation")), 10, true),
                new MonitorRequest.Rule("arrival-after-departure", null, "command", null,
                        "event.kind == 'arrival_confirmed' && milestones.departure.status == 'confirmed'"
                                + " && milestones.departure.evidence.gate == 'G3'",
                        List.of(new TripMonitor.Action("alert", "ordered")), 10, true)), MonitorScope.ANY));
        monitors.publish(tenant, ACTOR, "reports");
        new FeedProfileService(feeds, audit).save(tenant, ACTOR, FEED,
                new FeedProfileRequest("Reports", null, List.of(new FeedProfile.StagePlan("preparation", "ADDED"),
                        new FeedProfile.StagePlan("closing", "FINISHED")), "closing", null, null, null));
        FeedServiceRequest row = withReports(desired(1, 5, "ABC-123", null, "10000001"), Map.of(
                "arrival", new FeedServiceRequest.MilestoneReport(at(0), Map.of()),
                "departure", new FeedServiceRequest.MilestoneReport(at(-0.2), Map.of("gate", "G3"))));
        FeedResult result = send("S-042", row);
        assertEquals(List.of(), result.errors());
        assertTrue(engine.transitions(tenant, UUID.fromString(result.tripId()), 50).stream()
                .anyMatch(t -> t.matched().contains("arrival-after-departure")),
                () -> result.operations() + " " + engine.transitions(tenant, UUID.fromString(result.tripId()), 50));
    }

    @Test
    void anEmptyValidationReportWaitsForConfirmationWithoutBeingRequestedAgain() {
        Map<String, FeedServiceRequest.MilestoneReport> reports = Map.of("validation",
                new FeedServiceRequest.MilestoneReport(null, Map.of()));
        FeedResult result = send("S-043", withReports(desired(1, 5, "ABC-123", null, "10000001"), reports));
        assertEquals(TripMilestone.PENDING, milestone(result.tripId(), "validation").status());
        UUID tripId = UUID.fromString(result.tripId());
        assertThrows(IllegalStateException.class,
                () -> milestones.confirm(tenant, ACTOR, tripId, "departure", null, "ui", null));
        FeedResult changedPlan = send("S-043", withReports(desired(1, 6, "ABC-123", null, "10000001"), reports));
        assertTrue(changedPlan.operations().stream().noneMatch(op -> op.startsWith("report validation")));
    }

    @Test
    void actualTimesAndLaterReportsKeepMetadataOnAConfirmedMilestone() {
        FeedServiceRequest row = desired(1, 5, "ABC-123", null, "10000001");
        FeedServiceRequest departed = withActuals(row, at(-0.2), null, null);
        FeedResult result = send("S-044", withReports(departed, Map.of("departure",
                new FeedServiceRequest.MilestoneReport(null, Map.of("gate", "G3")))));
        assertEquals(Map.of("gate", "G3"), milestone(result.tripId(), "departure").evidence());
        send("S-044", withReports(row, Map.of("departure",
                new FeedServiceRequest.MilestoneReport(null, Map.of("seal", "checked")))));
        TripMilestone confirmed = milestone(result.tripId(), "departure");
        assertEquals(TripMilestone.CONFIRMED, confirmed.status());
        assertTrue(at(-0.2).isEqual(confirmed.confirmedAt()));
        assertEquals(Map.of("gate", "G3", "seal", "checked"), confirmed.evidence());
    }

    @Test
    void anActualTimeConfirmsItsMilestoneOnce() {
        FeedServiceRequest d = desired(-1, 5, "ABC-123", null, "10000001");
        FeedResult created = send("S-030", withActuals(d, at(-0.5), null, null));

        assertTrue(created.operations().stream().anyMatch(o -> o.startsWith("confirm departure at ")),
                created.operations().toString());
        TripMilestone departure = milestone(created.tripId(), TripMilestone.DEPARTURE);
        assertEquals(TripMilestone.CONFIRMED, departure.status());
        assertEquals("feed", departure.channel());
        assertTrue(at(-0.5).isEqual(departure.confirmedAt()));
        assertEquals(TripMilestone.OPEN, milestone(created.tripId(), TripMilestone.ARRIVAL).status());

        FeedResult same = send("S-030", withActuals(d, at(-0.5), null, null));
        assertEquals(List.of(), same.operations(), "the same actual time confirms nothing again");

        FeedResult secondsLater = send("S-030", withActuals(d, at(-0.5).plusSeconds(30), null, null));
        assertTrue(secondsLater.warnings().stream().anyMatch(w -> w.startsWith("departure was confirmed at")),
                "a different confirmed time must be reported even within one minute");
        assertTrue(audit.list(tenant, "trip", created.tripId(), null, null, 100).stream()
                .anyMatch(event -> MilestoneService.CONFLICT.equals(event.action())),
                "the feed conflict reaches the milestone service and its event publisher");

        FeedResult other = send("S-030", withActuals(d, at(-0.25), null, null));
        assertTrue(other.operations().stream().noneMatch(o -> o.startsWith("confirm")));
        assertTrue(other.warnings().stream().anyMatch(w -> w.startsWith("departure was confirmed at")),
                other.warnings().toString());
        assertTrue(at(-0.5).isEqual(milestone(created.tripId(), TripMilestone.DEPARTURE).confirmedAt()),
                "the first confirmation stays");
    }

    @Test
    void anEndedServiceWithItsActualTimesIsRecordedAsARegularizedTrip() {
        MonitorService monitors = new MonitorService(monitorStore, null, null, audit, tx);
        monitors.saveDraft(tenant, ACTOR, "direct", new MonitorRequest("Direct", null, List.of(), Map.of(), List.of(
                new MonitorRequest.Rule("open", null, "plan", null, "event.kind == 'created'",
                        List.of(new TripMonitor.Action("alert", "created")), 10, true)), MonitorScope.ANY));
        monitors.publish(tenant, ACTOR, "direct");

        FeedResult skipped = send("S-031", desired(-12, -5, "ABC-123", null, "10000001"));
        assertEquals(FeedReconciler.SKIP, skipped.action());
        assertTrue(skipped.warnings().get(0).contains("send its actual departure and closure"));

        FeedResult r = send("S-031", withActuals(desired(-12, -5, "ABC-123", null, "10000001"), at(-11.5), at(-6),
                at(-5.5)));

        assertEquals(FeedReconciler.REGULARIZE, r.action());
        assertEquals(List.of(), r.errors());
        UUID tripId = UUID.fromString(r.tripId());
        Trip t = trips.get(tenant, tripId);
        assertEquals(Trip.DONE, t.status());
        assertTrue(at(-11.5).isEqual(t.actualStart()), "the trip keeps its actual departure");
        assertTrue(at(-5.5).isEqual(t.actualEnd()), "and its actual closure");
        assertTrue(trip(r).assignments().stream().allMatch(a -> at(-11.5).isEqual(a.validFrom())),
                "historical assignments begin at the actual departure");
        assertTrue(engine.state(tenant, tripId).isEmpty(), "a regularized trip gets no monitor, not even one whose scope takes it");
        assertEquals(List.of(), engine.transitions(tenant, tripId, 50));
        for (String m : List.of(TripMilestone.DEPARTURE, TripMilestone.ARRIVAL, TripMilestone.CLOSURE)) {
            assertEquals(TripMilestone.CONFIRMED, milestone(r.tripId(), m).status(), m);
        }
        assertEquals(Mandate.CLOSED, mandates.get(tenant, UUID.fromString(r.mandateId())).status());
        assertFalse(feeds.service(tenant, FEED, "S-031").orElseThrow().open());
    }

    @Test
    void actualClosureTakesPrecedenceOverMissingOrFuturePlannedEnd() {
        FeedServiceRequest futurePlan = desired(-12, 5, "ABC-123", null, "10000001");
        FeedResult future = send("S-036", withActuals(futurePlan, at(-11), at(-6), at(-5)));
        assertEquals(FeedReconciler.REGULARIZE, future.action());
        assertEquals(Trip.DONE, trips.get(tenant, UUID.fromString(future.tripId())).status());

        FeedServiceRequest noPlannedEnd = new FeedServiceRequest(futurePlan.orderType(), futurePlan.orderRef(),
                futurePlan.origin(), futurePlan.destination(), futurePlan.plannedStart(), null, at(-11), at(-6),
                at(-5), futurePlan.resources(), null);
        FeedResult missing = send("S-037", noPlannedEnd);
        assertEquals(FeedReconciler.REGULARIZE, missing.action());
        assertEquals(Trip.DONE, trips.get(tenant, UUID.fromString(missing.tripId())).status());
    }

    @Test
    void invalidRegularizationDoesNotCreateAPartialTrip() {
        FeedServiceRequest ended = desired(-12, -5, "ABC-123", null, "10000001");
        FeedResult outOfOrder = send("S-034", withActuals(ended, at(-4), at(-7), at(-6)));
        assertEquals(FeedReconciler.REPORT, outOfOrder.action());
        assertTrue(outOfOrder.errors().get(0).contains("chronological order"));
        assertNull(outOfOrder.tripId());
        assertNull(outOfOrder.mandateId());

        FeedProfile current = feeds.profile(tenant, FEED).orElseThrow();
        feeds.saveProfile(new FeedProfile(tenant, FEED, current.name(), null,
                List.of(new FeedProfile.StagePlan("preparation", "ADDED")), "preparation",
                current.requiredResources(), true, true, null, ACTOR, null, ACTOR));
        FeedResult noClosing = send("S-035", withActuals(ended, at(-11), null, at(-6)));
        assertEquals(FeedReconciler.REPORT, noClosing.action());
        assertTrue(noClosing.errors().get(0).contains("closing as its final stage"));
        assertNull(noClosing.tripId());
        assertNull(noClosing.mandateId());
    }

    @Test
    void aChangeToAClosedTripIsReportedNotApplied() {
        FeedResult created = send("S-032", desired(2, 10, "ABC-123", null, "10000001"));
        UUID tripId = UUID.fromString(created.tripId());
        trip(created).stages().forEach(st -> {
            stages.start(tenant, ACTOR, UUID.fromString(st.id()));
            stages.close(tenant, ACTOR, UUID.fromString(st.id()));
        });

        FeedResult changed = send("S-032", desired(3, 12, "MNO-111", null, "10000001"));

        assertEquals(FeedReconciler.SKIP, changed.action());
        assertEquals(List.of("the trip is completed; the feed changed plannedStart, plannedEnd, resources,"
                + " which is not applied"), changed.warnings());
        assertEquals(at(2).toInstant(), trips.get(tenant, tripId).plannedStart().toInstant());
        assertEquals(List.of(fleetIds.abc()), openWindows(trip(created), "truck"));
        assertTrue(audit.list(tenant, "trip", tripId.toString(), null, null, 100).stream()
                .anyMatch(e -> FeedReconciler.CLOSED_CHANGED.equals(e.action())), "the change is audited");

        FeedResult closure = send("S-032", withActuals(desired(3, 12, "MNO-111", null, "10000001"), null, null,
                at(11)));
        assertEquals(FeedReconciler.UPDATE, closure.action(), "a closed trip still records its milestones");
        assertEquals(TripMilestone.CONFIRMED, milestone(created.tripId(), TripMilestone.CLOSURE).status());
    }

    @Test
    void asynchronousRecheckReportsChangesAgainstLastAppliedFeedState() throws Exception {
        FeedServiceRequest original = desired(2, 10, "ABC-123", null, "10000001");
        FeedResult created = send("S-033", original);
        trip(created).stages().forEach(stage -> {
            stages.start(tenant, ACTOR, UUID.fromString(stage.id()));
            stages.close(tenant, ACTOR, UUID.fromString(stage.id()));
        });

        FeedServiceRequest changed = desired(3, 12, "MNO-111", null, "10000001");
        assertTrue(reconciler.accept(tenant, FEED, "S-033", changed));
        FeedResult result = reconciler.recheck(tenant, ACTOR, FEED, "S-033");

        assertEquals(FeedReconciler.SKIP, result.action());
        assertTrue(result.warnings().stream().anyMatch(w -> w.contains("plannedStart, plannedEnd, resources")));
        assertEquals(at(2).toInstant(), trips.get(tenant, UUID.fromString(created.tripId())).plannedStart().toInstant());
        assertEquals(List.of(fleetIds.abc()), openWindows(trip(created), "truck"));
        FeedServiceRequest applied = json.readValue(
                feeds.service(tenant, FEED, "S-033").orElseThrow().appliedDesired(), FeedServiceRequest.class);
        assertTrue(applied.plannedStart().isEqual(changed.plannedStart()));
        assertTrue(applied.plannedEnd().isEqual(changed.plannedEnd()));
        assertEquals(changed.resources(), applied.resources());
        assertTrue(audit.list(tenant, "trip", created.tripId(), null, null, 100).stream()
                .anyMatch(event -> FeedReconciler.CLOSED_CHANGED.equals(event.action())));
    }

    @Test
    void theBoardShowsTheTripWithTheRowItsSourceSent() {
        FeedServiceRequest d = desired(2, 10, "ABC-123", null, "10000001");
        FeedResult r = send("S-020", new FeedServiceRequest(d.orderType(), d.orderRef(), "Origin A", "Destination B",
                d.plannedStart(), d.plannedEnd(), d.resources(),
                new ObjectMapper().valueToTree(Map.of("Observaciones", "sample note"))));
        PgBoardStore board = new PgBoardStore(() -> pool);
        UUID tripId = UUID.fromString(r.tripId());

        BoardRow row = board.trip(tenant, tripId).orElseThrow();
        assertEquals(List.of("S-020"), row.codes());
        assertEquals("ABC-123", row.truck());
        assertEquals("Origin A", row.origin());
        BoardStore.FeedSource feed = board.feedSource(tenant, tripId).orElseThrow();
        assertEquals(FEED, feed.feedKey());
        assertEquals("S-020", feed.externalCode());
        assertEquals("sample note", feed.source().get("Observaciones"));
        String attribute = """
                INSERT INTO miot_fleet.resource_attribute (tenant_code, resource_type, resource_id, attribute_type,
                    attribute_key, attribute_value, valid_until, source_system)
                VALUES ($1, 'driver', $2::uuid, 'TEST', $3, $4, $5, 'checks')""";
        pool.preparedQuery(attribute).executeAndAwait(Tuple.of(tenant, fleetIds.d1(), "ALCOHOL", "PASSED",
                OffsetDateTime.parse("2099-01-01T00:00:00Z")));
        pool.preparedQuery(attribute).executeAndAwait(Tuple.of(tenant, fleetIds.d1(), "DRUGS", "PASSED",
                OffsetDateTime.parse("2020-01-01T00:00:00Z")));
        BoardStore.TripDetails details = board.details(tenant, tripId).orElseThrow();
        assertEquals(List.of(new BoardStore.Order("S-020", "directo", "Cliente Prueba · Carga general")),
                details.orders());
        assertEquals(List.of(new BoardStore.Driver("Conductor", "10000001", null, List.of(
                new BoardStore.Validation("TEST", "ALCOHOL", "PASSED", "checks", "2099-01-01T00:00:00Z")))),
                details.drivers(), "an expired validation is left out");
        assertEquals(new BoardStore.Carrier("Transportes Prueba SAC", "20000000001", null), details.carrier());
        assertEquals("zone", details.originType(), "a place the feed creates is a zone");
        assertTrue(board.open(tenant, "s-020").stream().anyMatch(b -> b.tripId().equals(r.tripId())),
                "the search ignores case");
    }

    private FeedServiceRequest loaded(Integer sla, FeedServiceRequest.CargoItem... cargo) {
        FeedServiceRequest d = desired(2, 10, "ABC-123", null, "10000001");
        return new FeedServiceRequest(d.orderType(), d.orderRef(), null, null, d.plannedStart(), d.plannedEnd(),
                null, null, null, d.resources(), null, null, sla, List.of(cargo));
    }

    private static FeedServiceRequest.CargoItem unit(String description, String weightKg, String volumeM3) {
        return new FeedServiceRequest.CargoItem(description, java.math.BigDecimal.ONE, "pallet",
                new java.math.BigDecimal(weightKg), new java.math.BigDecimal(volumeM3));
    }

    @Test
    void theFeedsCargoAndSlaReachTheMandateAndTheTripsLoadAndLeadTime() {
        FeedResult r = withCargo.reconcile(tenant, ACTOR, FEED, "S-030",
                loaded(600, unit("Pallet A", "1000", "2.5"), unit("Pallet B", "500", "1.5")), false);
        assertTrue(r.errors().isEmpty(), () -> r.errors().toString());
        UUID tripId = UUID.fromString(r.tripId());
        PgBoardStore board = new PgBoardStore(() -> pool);
        BoardStore.TripDetails details = board.details(tenant, tripId).orElseThrow();
        assertEquals(2, details.load().units());
        assertEquals(0, new java.math.BigDecimal("1500").compareTo(details.load().weightKg()));
        assertEquals(0, new java.math.BigDecimal("4.0").compareTo(details.load().volumeM3()));
        assertEquals(new BoardStore.LeadTime(0, 0, 1, 0), details.leadTime(), "an SLA not delivered yet is open");
        assertEquals(List.of("Pallet A", "Pallet B"),
                details.cargo().stream().map(BoardStore.Cargo::description).toList());
        assertEquals("pallet", details.cargo().getFirst().qtyUnit());
        assertEquals(600, mandates.get(tenant, UUID.fromString(r.mandateId())).slaMinutes());

        FeedResult changed = withCargo.reconcile(tenant, ACTOR, FEED, "S-030",
                loaded(720, unit("Pallet A", "1200", "2.5")), false);
        assertTrue(changed.errors().isEmpty(), () -> changed.errors().toString());
        assertTrue(changed.warnings().stream().anyMatch(w -> w.contains("no longer sent")), "a dropped unit stays");
        assertEquals(720, mandates.get(tenant, UUID.fromString(r.mandateId())).slaMinutes());
        assertEquals(0, new java.math.BigDecimal("1700").compareTo(
                board.details(tenant, tripId).orElseThrow().load().weightKg()));

        FeedResult same = withCargo.reconcile(tenant, ACTOR, FEED, "S-030",
                loaded(720, unit("Pallet A", "1200.0", "2.50")), false);
        assertEquals(List.of(), same.operations(), "the same units in another scale change nothing");
    }

    @Test
    void cargoAlreadyAnnouncedForTheMandateIsMountedWhenTheFeedCreatesItsTrip() {
        Mandate mandate = mandates.createOrGet(tenant, ACTOR,
                new com.microboxlabs.miot.trips.dto.MandateRequest("S-031", "direct", loaded(600).orderRef(), null, null, null))
                .mandate();
        var unit = unit("Pallet A", "1000", "2.5");
        cargoUnits.announce(tenant, ACTOR, UUID.fromString(mandate.id()),
                new com.microboxlabs.miot.trips.dto.CargoRequest(unit.description(), unit.qty(), unit.qtyUnit(),
                        unit.weightKg(), unit.volumeM3(), null));
        FeedResult result = withCargo.reconcile(tenant, ACTOR, FEED, "S-031", loaded(600, unit), false);
        assertEquals(1, new PgBoardStore(() -> pool).details(tenant, UUID.fromString(result.tripId()))
                .orElseThrow().load().units());
        assertEquals(1, cargoUnits.listByMandate(tenant, UUID.fromString(mandate.id())).size());
        assertEquals(List.of(), withCargo.reconcile(tenant, ACTOR, FEED, "S-031", loaded(600, unit), false)
                .operations());
    }

    @Test
    void cargoAndSlaChangesToAClosedTripAreReportedAndKeptUnchanged() {
        FeedResult first = withCargo.reconcile(tenant, ACTOR, FEED, "S-032",
                loaded(600, unit("Pallet A", "1000", "2.5")), false);
        UUID tripId = UUID.fromString(first.tripId());
        trips.cancel(tenant, ACTOR, tripId, "test closure");
        FeedResult changed = withCargo.reconcile(tenant, ACTOR, FEED, "S-032",
                loaded(720, unit("Pallet A", "2000", "3.0")), false);
        assertTrue(changed.warnings().stream().anyMatch(w -> w.contains("slaMinutes") && w.contains("cargo")),
                () -> changed.warnings().toString());
        assertEquals(600, mandates.get(tenant, UUID.fromString(first.mandateId())).slaMinutes());
        assertEquals(0, new java.math.BigDecimal("1000").compareTo(new PgBoardStore(() -> pool)
                .details(tenant, tripId).orElseThrow().load().weightKg()));
    }

    @Test
    void omittedCargoValuesAndNormalizedStringsDoNotKeepUpdatingTheSameUnit() {
        FeedResult first = withCargo.reconcile(tenant, ACTOR, FEED, "S-034",
                loaded(600, unit("Pallet A", "1000", "2.5")), false);
        var sparse = new FeedServiceRequest.CargoItem(" Pallet A ", null, " pallet ", null, null);
        for (int i = 0; i < 2; i++) {
            assertEquals(List.of(), withCargo.reconcile(tenant, ACTOR, FEED, "S-034", loaded(600, sparse), false)
                    .operations());
        }
        var clearUnit = new FeedServiceRequest.CargoItem(null, null, " ", null, null);
        withCargo.reconcile(tenant, ACTOR, FEED, "S-034", loaded(600, clearUnit), false);
        assertEquals(List.of(), withCargo.reconcile(tenant, ACTOR, FEED, "S-034", loaded(600, clearUnit), false)
                .operations());
        var stored = cargoUnits.listByMandate(tenant, UUID.fromString(first.mandateId())).get(0);
        assertNull(stored.qtyUnit());
        assertEquals("Pallet A", stored.description());
        assertEquals(0, new java.math.BigDecimal("1000").compareTo(stored.weightKg()));
    }

    @Test
    void ongoingTripsShowOnlyCurrentDriversAndClosedTripsKeepTheirHistory() {
        FeedResult first = send("S-035", desired(2, 10, "ABC-123", null, "10000001", "10000002"));
        UUID tripId = UUID.fromString(first.tripId());
        AssignmentView former = trips.detail(tenant, tripId).assignments().stream()
                .filter(a -> a.resourceId().equals(fleetIds.d2())).findFirst().orElseThrow();
        assignments.end(tenant, ACTOR, UUID.fromString(former.id()), null, "test replacement");
        PgBoardStore board = new PgBoardStore(() -> pool);
        assertEquals(List.of("10000001"), board.details(tenant, tripId).orElseThrow().drivers().stream()
                .map(BoardStore.Driver::rut).toList());
        trips.cancel(tenant, ACTOR, tripId, "test closure");
        assertEquals(2, board.details(tenant, tripId).orElseThrow().drivers().size());
    }

    @Test
    void aRowWithoutCargoOrSlaKeepsItsHash() {
        FeedServiceRequest d = desired(2, 10, "ABC-123", null, "10000001");
        assertEquals(reconciler.hash(d), reconciler.hash(new FeedServiceRequest(d.orderType(), d.orderRef(), null,
                null, d.plannedStart(), d.plannedEnd(), null, null, null, d.resources(), null, null, null, null)));
    }

    private void registering() {
        FeedProfile base = feeds.profile(tenant, FEED).orElseThrow();
        feeds.saveProfile(new FeedProfile(tenant, FEED, base.name(), null, base.stages(), base.arrivalStage(),
                base.requiredResources(), true, true, null, ACTOR, null, ACTOR));
    }

    private FeedServiceRequest registered(double startH, double endH, String truck, String trailer,
            FeedServiceRequest.Carrier carrier, List<FeedServiceRequest.Person> people, String... drivers) {
        return new FeedServiceRequest("directo", "Cliente Prueba · Carga general", at(startH), at(endH),
                new FeedServiceRequest.Resources(truck, trailer, List.of(drivers), carrier, people), null);
    }

    @Test
    void aFeedThatRegistersResourcesAddsTheUnknownOnesToFleetBeforeTheTrip() {
        registering();
        FeedServiceRequest.Carrier carrier = new FeedServiceRequest.Carrier("20-99999999-1", "Transportes Nuevos SAC");
        FeedServiceRequest d = registered(1, 6, "NEW-101", "NEW-202", carrier, List.of(
                new FeedServiceRequest.Person("20000001", "Conductor Uno", "+51 900 000 001"),
                new FeedServiceRequest.Person("2000-0002", "Conductor Dos", " ")), "20000001", "20000002");

        FeedResult dry = reconciler.reconcile(tenant, ACTOR, FEED, "S-050", d, true);
        assertEquals(List.of(), dry.errors());
        assertTrue(dry.operations().containsAll(List.of("find or register carrier Transportes Nuevos SAC",
                "register truck NEW-101", "register trailer NEW-202", "register driver 20000001",
                "register driver 20000002")), dry.operations().toString());
        assertTrue(fleet.byPlate(tenant, "truck", "NEW-101").isEmpty(), "a dry run registers nothing");

        FeedResult r = send("S-050", d);
        assertEquals(FeedReconciler.CREATE, r.action());
        assertEquals(List.of(), r.errors());
        UUID carrierId = fleet.carrierByTaxId(tenant, "20999999991").orElseThrow().id();
        UUID truck = fleet.byPlate(tenant, "truck", "NEW-101").orElseThrow().id();
        UUID trailer = fleet.byPlate(tenant, "trailer", "NEW-202").orElseThrow().id();
        assertEquals(carrierId, fleet.vehicle(tenant, "truck", truck).orElseThrow().carrierId());
        assertEquals(carrierId, fleet.vehicle(tenant, "trailer", trailer).orElseThrow().carrierId());
        UUID first = fleet.driverByDocument(tenant, "20000001").orElseThrow().id();
        FleetResources.Driver one = fleet.driver(tenant, first).orElseThrow();
        assertEquals("Conductor Uno", one.fullName());
        assertEquals("+51 900 000 001", one.phone());
        UUID second = fleet.driverByDocument(tenant, "20000002").orElseThrow().id();
        assertEquals("Conductor Dos", fleet.driver(tenant, second).orElseThrow().fullName(),
                "details match the driver ignoring dashes");
        assertEquals(List.of(truck.toString(), trailer.toString(), first.toString(), second.toString()),
                trip(r).assignments().stream().map(AssignmentView::resourceId).toList());

        FeedResult again = send("S-051", registered(2, 7, "NEW-101", null, carrier, List.of(), "20000001"));
        assertEquals(List.of(), again.errors());
        assertTrue(again.operations().stream().noneMatch(o -> o.startsWith("register")), again.operations().toString());
        assertEquals(1, fleet.carriers(tenant, "Transportes Nuevos", 10).size(), "the carrier is not registered twice");
    }

    @Test
    void aKnownCarrierIsReusedAndAVehicleWithoutOneIsReported() {
        registering();
        FeedResult reused = send("S-052", registered(1, 6, "NEW-303", null,
                new FeedServiceRequest.Carrier("20000000001", null), List.of(), "10000001"));
        assertEquals(List.of(), reused.errors());
        UUID truck = fleet.byPlate(tenant, "truck", "NEW-303").orElseThrow().id();
        assertEquals(fleet.carrierByTaxId(tenant, "20000000001").orElseThrow().id(),
                fleet.vehicle(tenant, "truck", truck).orElseThrow().carrierId());

        FeedResult missing = send("S-053", registered(1, 6, "NEW-404", null, null, List.of(), "20000009"));
        assertEquals(FeedReconciler.REPORT, missing.action());
        assertEquals(List.of("truck NEW-404 is not in the fleet directory; send its carrier's tax id to register it"),
                missing.errors());
        assertTrue(fleet.driverByDocument(tenant, "20000009").isEmpty(), "a reported service registers nothing");
    }

    @Test
    void anInactiveCarrierCannotRegisterNewResourcesEvenInADryRun() {
        registering();
        pool.preparedQuery("UPDATE miot_fleet.carrier SET status = 'inactive' WHERE tenant_code = $1")
                .execute(Tuple.of(tenant)).await().atMost(WAIT);
        FeedServiceRequest request = registered(1, 6, "TEST-101", null,
                new FeedServiceRequest.Carrier("20000000001", null), List.of(), "TEST-DRIVER-01");
        FeedResult dry = reconciler.reconcile(tenant, ACTOR, FEED, "S-054", request, true);
        assertEquals(FeedReconciler.REPORT, dry.action());
        assertEquals(List.of("carrier 20000000001 is inactive"), dry.errors());
        FeedResult result = send("S-054", request);
        assertEquals(FeedReconciler.REPORT, result.action());
        assertEquals(dry.errors(), result.errors());
        assertTrue(fleet.byPlate(tenant, "truck", "TEST-101").isEmpty());
        assertTrue(fleet.driverByDocument(tenant, "TEST-DRIVER-01").isEmpty());
        assertNull(result.tripId());
    }

    @Test
    void repeatedDocumentsRegisterAndAssignOneDriver() {
        registering();
        FeedResult result = send("S-055", registered(1, 6, "ABC-123", null, null,
                List.of(new FeedServiceRequest.Person("TESTDRIVER02", "Example Driver", null)),
                "test-driver-02", "TESTDRIVER02"));
        UUID driverId = fleet.driverByDocument(tenant, "TESTDRIVER02").orElseThrow().id();
        assertEquals(List.of(driverId.toString()), openWindows(trip(result), "driver"));
        assertEquals(1, result.operations().stream().filter(o -> o.startsWith("register driver ")).count());
    }

    @Test
    void aFailureAfterRegistrationRollsBackEveryNewFleetResource() {
        registering();
        FeedServiceRequest request = registered(1, 6, "TEST-303", null,
                new FeedServiceRequest.Carrier("TEST-CARRIER-03", "Example Carrier"),
                List.of(new FeedServiceRequest.Person("TESTDRIVER03", "Example Driver", "x".repeat(65))),
                "TESTDRIVER03");
        assertThrows(IllegalArgumentException.class, () -> send("S-056", request));
        assertTrue(fleet.carrierByTaxId(tenant, "TESTCARRIER03").isEmpty());
        assertTrue(fleet.byPlate(tenant, "truck", "TEST-303").isEmpty());
        assertTrue(fleet.driverByDocument(tenant, "TESTDRIVER03").isEmpty());
        assertEquals(FeedReconciler.ERROR, feeds.service(tenant, FEED, "S-056").orElseThrow().lastAction());
    }

    @Test
    void concurrentNormalizedCarriersShareOneIdentity() throws Exception {
        CountDownLatch readMissing = new CountDownLatch(2);
        CompletableFuture<Void> proceed = new CompletableFuture<>();
        var first = CompletableFuture.supplyAsync(
                () -> registerAfterLookup("TEST-CARRIER-04", readMissing, proceed));
        var second = CompletableFuture.supplyAsync(
                () -> registerAfterLookup("testcarrier04", readMissing, proceed));
        assertTrue(readMissing.await(5, TimeUnit.SECONDS), "both transactions first observe a missing carrier");
        proceed.complete(null);
        UUID carrierId = first.get(5, TimeUnit.SECONDS);
        assertEquals(carrierId, second.get(5, TimeUnit.SECONDS));
        assertEquals(1, fleet.carriers(tenant, "Concurrent Example", 10).size());

        UUID truckId = fleet.registerVehicle(tenant, ACTOR, "truck", "TEST-404", carrierId);
        assertEquals(truckId, fleet.registerVehicle(tenant, ACTOR, "truck", "test404", carrierId));
        UUID driverId = fleet.registerDriver(tenant, ACTOR, "TEST-DRIVER-04", "Example Driver", null, carrierId);
        assertEquals(driverId, fleet.registerDriver(tenant, ACTOR, "testdriver04", "Another Name", null, carrierId));
        assertEquals("Example Driver", fleet.driver(tenant, driverId).orElseThrow().fullName(),
                "reusing a normalized document never overwrites existing details");
    }

    private UUID registerAfterLookup(String taxId, CountDownLatch readMissing, CompletableFuture<Void> proceed) {
        return tx.inTransaction(() -> {
            assertTrue(fleet.carrierByTaxId(tenant, taxId).isEmpty());
            readMissing.countDown();
            proceed.orTimeout(5, TimeUnit.SECONDS).join();
            return fleet.registerCarrier(tenant, ACTOR, taxId, "Concurrent Example Carrier");
        });
    }
}

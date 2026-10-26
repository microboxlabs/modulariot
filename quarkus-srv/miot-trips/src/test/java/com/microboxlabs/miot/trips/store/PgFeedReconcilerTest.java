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
import com.microboxlabs.miot.trips.domain.BoardRow;
import com.microboxlabs.miot.trips.domain.FeedService;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.dto.MonitorViews;
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
    private final MilestoneService milestones = new MilestoneService(new PgMilestoneStore(() -> pool),
            new PgTripStore(() -> pool), audit, tx);
    private final FeedReconciler reconciler = new FeedReconciler(feeds, mandates, trips, stages, assignments,
            locations, milestones, audit, fleet, tx, json, clock);
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
        FeedServiceJobHandler handler = new FeedServiceJobHandler(reconciler, json);
        FeedBatchRequest first = new FeedBatchRequest("b1", List.of(
                new FeedBatchRequest.Item("S-001", desired(2, 10, "ABC-123", "DEF-456", "10000001")),
                new FeedBatchRequest.Item(" ", desired(2, 10, "ABC-123", null, "10000001"))));

        FeedBatchResult r1 = batches.send(tenant, ACTOR, FEED, first);
        assertEquals(List.of("S-001"), r1.queued());
        assertEquals(List.of(""), r1.refused().stream().map(FeedBatchResult.Refusal::externalCode).toList(), "a blank code is refused, not queued");
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
        }
        assertTrue(queued.isEmpty());
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

    private FeedServiceRequest withActuals(FeedServiceRequest d, OffsetDateTime start, OffsetDateTime arrival,
            OffsetDateTime end) {
        return new FeedServiceRequest(d.orderType(), d.orderRef(), d.origin(), d.destination(), d.plannedStart(),
                d.plannedEnd(), start, arrival, end, d.resources(), null);
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
        assertThrows(IllegalArgumentException.class, () -> send("S-041", new FeedServiceRequest(d.orderType(),
                d.orderRef(), null, null, d.plannedStart(), d.plannedEnd(), null, null, null, d.resources(), null,
                Map.of("unloading", new FeedServiceRequest.MilestoneReport(null, Map.of())))));
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
        MonitorService monitors = new MonitorService(monitorStore, audit, tx);
        monitors.saveDraft(tenant, ACTOR, "direct", new MonitorRequest("Direct", null, List.of(), Map.of(), List.of(
                new MonitorRequest.Rule("open", null, "plan", null, "event.kind == 'created'",
                        List.of(new TripMonitor.Action("alert", "created")), 10, true))));
        monitors.publish(tenant, ACTOR, "direct");
        monitors.saveSelector(tenant, ACTOR, new MonitorViews.SelectorRequest(List.of(
                new MonitorViews.SelectorRequest.Entry("trip.orderType == 'directo'", "direct"))));

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
        assertTrue(engine.state(tenant, tripId).isEmpty(), "a regularized trip gets no monitor, not even the selector's");
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
        feeds.saveProfile(new FeedProfile(tenant, FEED, current.name(),
                List.of(new FeedProfile.StagePlan("preparation", "ADDED")), "preparation", null,
                current.requiredResources(), true, null, ACTOR, null, ACTOR));
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
        assertTrue(board.open(tenant, "s-020").stream().anyMatch(b -> b.tripId().equals(r.tripId())),
                "the search ignores case");
    }
}

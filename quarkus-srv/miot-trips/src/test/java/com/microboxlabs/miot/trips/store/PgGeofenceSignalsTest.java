package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.fleet.resources.domain.Carrier;
import com.microboxlabs.miot.fleet.resources.domain.Truck;
import com.microboxlabs.miot.fleet.resources.service.FleetResourcesService;
import com.microboxlabs.miot.fleet.resources.store.PgResourceStore;
import com.microboxlabs.miot.trips.domain.MonitorScope;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripLiveRow;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.dto.AssignmentRequest;
import com.microboxlabs.miot.trips.dto.MonitorRequest;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.dto.StageView;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.dto.TripView;
import com.microboxlabs.miot.trips.service.MilestoneService;
import com.microboxlabs.miot.trips.service.AssignmentService;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.GeofenceSignals;
import com.microboxlabs.miot.trips.service.MandateService;
import com.microboxlabs.miot.trips.service.MonitorEngine;
import com.microboxlabs.miot.trips.service.MonitorService;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * GPS signals moving a trip by its geofences: the vehicle leaves the origin and the monitor starts transit; it
 * enters the destination and the trip completes. Skipped unless {@code -Dmiot.trips.test.pg-url=…} is set.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgGeofenceSignalsTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String ACTOR = "ops@example.com";
    private static final int ORIGIN = 9101;
    private static final int DESTINATION = 9102;

    private static Vertx vertx;
    private static Pool pool;

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
    private final PgResourceStore resources = new PgResourceStore(() -> pool);
    private final FleetResourcesService fleet = new FleetResourcesService(resources);
    private final AssignmentService assignments = new AssignmentService(new PgAssignmentStore(() -> pool),
            new PgTripStore(() -> pool), fleet, projector, audit, tx);
    private final PgMonitorStore monitorStore = new PgMonitorStore(() -> pool);
    private final MonitorService monitors = new MonitorService(monitorStore, null, null, audit, tx);
    private final MilestoneService milestones = new MilestoneService(new PgMilestoneStore(() -> pool),
            new PgTripStore(() -> pool), audit, tx);
    private final MonitorEngine engine = new MonitorEngine(new PgMonitorRunStore(() -> pool), monitorStore,
            new PgTripStore(() -> pool), new PgStageStore(() -> pool), new PgAssignmentStore(() -> pool),
            new PgLocationStore(() -> pool), stages, trips, mandates, milestones, fleet, audit, tx, Clock.systemUTC());
    private final PgLocationStore locations = new PgLocationStore(() -> pool);
    private final PgTripLiveStore live = new PgTripLiveStore(() -> pool);
    private final FakeGeofences geofences = new FakeGeofences()
            .square(ORIGIN, -70.6, -33.4, 0.01).square(DESTINATION, -70.2, -23.6, 0.01);
    private final GeofenceSignals signals = new GeofenceSignals(live, geofences, engine,
            tx, true, 2, Duration.ofMinutes(10));

    private String tenant;
    private Instant at = Instant.parse("2026-10-24T12:00:00Z");

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

    @BeforeEach
    void tenantWithAMonitor() {
        engineRef[0] = engine;
        tenant = "t-" + UUID.randomUUID().toString().substring(0, 8);
        monitors.saveDraft(tenant, ACTOR, "direct", new MonitorRequest("Direct", null, List.of(), Map.of(), List.of(
                rule("open", "plan", "event.kind == 'created'", new TripMonitor.Action("start", "preparation")),
                rule("departure", "signal",
                        "stage.type == 'preparation' && signal.kind == 'left_origin'"
                                + " && signal.geofenceId == trip.origin.geofenceId",
                        new TripMonitor.Action("advance", "transit")),
                rule("arrival", "signal", "stage.type == 'transit' && signal.kind == 'entered_destination'",
                        new TripMonitor.Action("completeTrip", null))), MonitorScope.ANY));
        monitors.publish(tenant, ACTOR, "direct");
    }

    private static MonitorRequest.Rule rule(String key, String on, String when, TripMonitor.Action action) {
        return new MonitorRequest.Rule(key, null, on, null, when, List.of(action), 10, true);
    }

    private UUID tripWithTruck(String plate) {
        Location origin = locations.insert(new Location(null, tenant, "Terminal Norte", "zone", "TN", null, ORIGIN,
                null, ACTOR, null, ACTOR));
        Location destination = locations.insert(new Location(null, tenant, "Planta Sur", "zone", "PS", null,
                DESTINATION, null, ACTOR, null, ACTOR));
        List<StageRequest> plan = List.of("preparation", "transit", "closing").stream()
                .map(t -> new StageRequest(t, null, null, null, null, null)).toList();
        TripView t = trips.create(tenant, ACTOR, new TripRequest(origin.id(), destination.id(), null, List.of(), plan,
                "direct"));
        Carrier c = resources.insertCarrier(new Carrier(null, tenant, null, "20000000001", "Transportes Prueba",
                null, null, null, null, null, Carrier.ACTIVE, false, null, null, null, ACTOR, null, ACTOR));
        String truck = resources.insertTruck(new Truck(null, tenant, c.id(), null, plate, null, null, null, null,
                Carrier.ACTIVE, false, null, null, null, ACTOR, null, ACTOR)).id();
        UUID id = UUID.fromString(t.id());
        assignments.create(tenant, ACTOR, id, new AssignmentRequest("truck", truck, null, null));
        return id;
    }

    /** One GPS signal of the vehicle, a minute after the previous one unless {@code at} is given. */
    private int frame(String asset, double lon, double lat, String client) {
        at = at.plusSeconds(60);
        return signals.accept(signal(asset, lon, lat, client, at));
    }

    private static String signal(String asset, double lon, double lat, String client, Instant at) {
        return """
                {"schema":"miot.gps.signal@1","asset_id":"%s","at":"%s","clients":["%s"],
                 "frame":{"gps":{"latitude":%s,"longitude":%s,"speed":40}}}"""
                .formatted(asset, at, client, lat, lon);
    }

    private String status(UUID tripId, String type) {
        return trips.detail(tenant, tripId).stages().stream().filter(s -> s.stageType().equals(type))
                .map(StageView::status).findFirst().orElseThrow();
    }

    private TripLiveRow row(UUID tripId) {
        return live.find(tenant, tripId).orElseThrow();
    }

    @Test
    void unusableAssetDoesNotPreventOtherTripsFromInitializing() {
        UUID invalid = tripWithTruck("TEST-INVALID");
        Pg.query(pool, "UPDATE miot_trips.trip_live SET asset_id = '-' WHERE trip_id = $1",
                io.vertx.mutiny.sqlclient.Tuple.of(invalid));
        tenantWithAMonitor();
        UUID valid = tripWithTruck("TEST-VALID");
        signals.refresh();
        assertEquals(0, frame("TEST-VALID", -70.6, -33.4, tenant));
        assertEquals(1, frame("TEST-VALID", -70.6, -33.4, tenant));
        assertEquals(ORIGIN, row(valid).currentGeofenceId());
    }

    @Test
    void sharedAssetWatermarksAreIsolatedByTenantAndTrip() {
        UUID first = tripWithTruck("TEST-SHARED");
        String firstTenant = tenant;
        tenantWithAMonitor();
        UUID second = tripWithTruck("TEST-SHARED");
        GeofenceSignals checked = new GeofenceSignals(live, geofences, engine, tx, true, 1, Duration.ofMinutes(10));
        checked.refresh();
        assertEquals(1, checked.accept(signal("TEST-SHARED", -70.6, -33.4, firstTenant, at.plusSeconds(60))));
        assertEquals(1, checked.accept(signal("TEST-SHARED", -70.6, -33.4, tenant, at)));
        assertEquals(0, checked.accept(signal("TEST-SHARED", -70.5, -33.4, tenant, at)));
        assertEquals(ORIGIN, live.find(firstTenant, first).orElseThrow().currentGeofenceId());
        assertEquals(ORIGIN, row(second).currentGeofenceId());
    }

    @Test
    void repeatedFramesCannotConfirmAMoveAndMissingShapesCannotMeanDeparture() {
        UUID tripId = tripWithTruck("TEST-123");
        GeofenceSignals checked = new GeofenceSignals(live, geofences,
                (tenantCode, id, kind, fence, time) -> {}, tx, Clock.systemUTC(), new GeofenceSignals.Settings(true, 2, Duration.ZERO));
        checked.refresh();
        String first = signal("TEST-123", -70.6, -33.4, tenant, at);
        assertEquals(0, checked.accept(first));
        assertEquals(0, checked.accept(first));
        assertNull(row(tripId).currentGeofenceId());
        assertEquals(1, checked.accept(signal("TEST-123", -70.6, -33.4, tenant, at.plusSeconds(1))));
        assertEquals(ORIGIN, row(tripId).currentGeofenceId());
        geofences.shape(ORIGIN, "null");
        checked.refresh();
        assertEquals(0, checked.accept(signal("TEST-123", -70.5, -33.4, tenant, at.plusSeconds(2))));
        assertEquals(0, checked.accept(signal("TEST-123", -70.5, -33.4, tenant, at.plusSeconds(3))));
        assertEquals(ORIGIN, row(tripId).currentGeofenceId());
    }

    @Test
    void replicasReadMotorStateBeforeEmittingEdges() {
        UUID tripId = tripWithTruck("TEST-REPLICA");
        java.util.ArrayList<String> edges = new java.util.ArrayList<>();
        GeofenceSignals.Sink sink = (t, id, kind, fence, time) -> edges.add(kind);
        GeofenceSignals first = new GeofenceSignals(live, geofences, sink, tx, Clock.systemUTC(),
                new GeofenceSignals.Settings(true, 1, Duration.ofMinutes(10)));
        GeofenceSignals second = new GeofenceSignals(live, geofences, sink, tx, Clock.systemUTC(),
                new GeofenceSignals.Settings(true, 1, Duration.ofMinutes(10)));
        first.refresh();
        second.refresh();
        assertEquals(1, first.accept(signal("TEST-REPLICA", -70.6, -33.4, tenant, at)));
        assertEquals(0, second.accept(signal("TEST-REPLICA", -70.6, -33.4, tenant, at.plusSeconds(1))));
        assertEquals(1, second.accept(signal("TEST-REPLICA", -70.5, -33.4, tenant, at.plusSeconds(2))));
        assertEquals(0, first.accept(signal("TEST-REPLICA", -70.5, -33.4, tenant, at.plusSeconds(3))));
        assertEquals(List.of("entered_origin", "left_origin"), edges);
        assertTrue(row(tripId).originVisited());
        assertNull(row(tripId).currentGeofenceId());
    }

    @Test
    void failedMonitorActionRollsBackMotorStateAndCanRetry() {
        monitors.saveDraft(tenant, ACTOR, "broken", new MonitorRequest("Test", null, List.of(), Map.of(), List.of(
                rule("bad", "signal", "signal.kind == 'entered_origin'",
                        new TripMonitor.Action("advance", "unloading"))), new MonitorScope(List.of(), List.of("other"), List.of(), List.of())));
        monitors.publish(tenant, ACTOR, "broken");
        UUID tripId = tripWithTruck("TEST-RETRY");
        engine.bind(tenant, ACTOR, tripId, "broken", null);
        GeofenceSignals checked = new GeofenceSignals(live, geofences, engine, tx, true, 1, Duration.ofMinutes(10));
        assertEquals(0, checked.accept(signal("TEST-RETRY", -70.6, -33.4, tenant, at)));
        assertNull(row(tripId).currentGeofenceId());
        assertFalse(row(tripId).originVisited());
        engine.bind(tenant, ACTOR, tripId, "direct", null);
        assertEquals(1, checked.accept(signal("TEST-RETRY", -70.6, -33.4, tenant, at.plusSeconds(1))));
        assertEquals(ORIGIN, row(tripId).currentGeofenceId());
    }

    @Test
    void initializationFailureNacksAndRetriesBeforeConsuming() {
        tripWithTruck("TEST-START");
        java.util.concurrent.atomic.AtomicBoolean unavailable = new java.util.concurrent.atomic.AtomicBoolean(true);
        PgTripLiveStore startupLive = new PgTripLiveStore(() -> pool) {
            @Override
            public List<TripLiveRow> watched() {
                if (unavailable.get()) throw new IllegalStateException("test unavailable");
                return super.watched();
            }
        };
        GeofenceSignals checked = new GeofenceSignals(startupLive, geofences,
                (t, id, kind, fence, time) -> {}, tx, Clock.systemUTC(),
                new GeofenceSignals.Settings(true, 1, Duration.ofMinutes(10)));
        java.util.concurrent.atomic.AtomicInteger acks = new java.util.concurrent.atomic.AtomicInteger();
        java.util.concurrent.atomic.AtomicInteger nacks = new java.util.concurrent.atomic.AtomicInteger();
        byte[] payload = signal("TEST-START", -70.6, -33.4, tenant, at)
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var message = org.eclipse.microprofile.reactive.messaging.Message.of(payload,
                () -> { acks.incrementAndGet(); return java.util.concurrent.CompletableFuture.completedFuture(null); },
                failure -> { nacks.incrementAndGet(); return java.util.concurrent.CompletableFuture.completedFuture(null); });
        checked.onSignal(message).toCompletableFuture().join();
        assertEquals(0, acks.get());
        assertEquals(1, nacks.get());
        unavailable.set(false);
        checked.onSignal(message).toCompletableFuture().join();
        assertEquals(1, acks.get());
        assertEquals(1, nacks.get());
    }

    @Test
    void leavingTheOriginAndEnteringTheDestinationMoveTheTrip() {
        UUID tripId = tripWithTruck("ABC-123");
        assertEquals(ORIGIN, row(tripId).originGeofenceId());
        signals.refresh();

        assertEquals(0, frame("abc 123", -70.6, -33.4, tenant), "one frame inside is not enough");
        assertEquals(1, frame("ABC123", -70.6, -33.4, tenant), "the second confirms entered_origin");
        assertEquals(ORIGIN, row(tripId).currentGeofenceId());
        assertTrue(row(tripId).originVisited());
        assertEquals(Stage.RUNNING, status(tripId, "preparation"));

        assertEquals(0, frame("ABC-123", -70.5, -33.4, "another-client"), "another client's vehicle");
        assertEquals(0, signals.accept(signal("ABC-123", -70.0, -30.0, tenant, at.minusSeconds(3600))),
                "an older frame is skipped");
        assertEquals(0, frame("ABC-123", -70.5, -33.4, tenant));
        assertEquals(1, frame("ABC-123", -70.4, -33.3, tenant), "left_origin");
        assertNull(row(tripId).currentGeofenceId());
        assertEquals(Stage.RUNNING, status(tripId, "transit"), "the monitor started transit");

        frame("ABC-123", -70.2, -23.6, tenant);
        assertEquals(0, frame("ABC-123", -70.1, -25.0, tenant), "back outside before it was confirmed");
        frame("ABC-123", -70.2, -23.6, tenant);
        assertEquals(1, frame("ABC-123", -70.2, -23.6, tenant), "entered_destination");
        assertEquals(Trip.DONE, trips.get(tenant, tripId).status());
        assertTrue(live.find(tenant, tripId).isEmpty(), "a finished trip has no hot row");

        signals.refresh();
        assertEquals(0, frame("ABC-123", -70.6, -33.4, tenant), "a finished trip is no longer watched");
        assertFalse(engine.transitions(tenant, tripId, 50).stream()
                .anyMatch(x -> x.error() != null), "no rule failed");
    }
}

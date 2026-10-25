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
    private final MonitorService monitors = new MonitorService(monitorStore, audit, tx);
    private final MonitorEngine engine = new MonitorEngine(new PgMonitorRunStore(() -> pool), monitorStore,
            new PgTripStore(() -> pool), new PgStageStore(() -> pool), new PgAssignmentStore(() -> pool),
            new PgLocationStore(() -> pool), stages, trips, mandates, fleet, audit, tx, Clock.systemUTC());
    private final PgLocationStore locations = new PgLocationStore(() -> pool);
    private final PgTripLiveStore live = new PgTripLiveStore(() -> pool);
    private final FakeGeofences geofences = new FakeGeofences()
            .square(ORIGIN, -70.6, -33.4, 0.01).square(DESTINATION, -70.2, -23.6, 0.01);
    private final GeofenceSignals signals = new GeofenceSignals(live, geofences,
            (tenant, trip, kind, geofence, at) -> engine.signal(tenant, GeofenceSignals.ACTOR, trip, kind,
                    String.valueOf(geofence), at), tx, Clock.systemUTC(), true, 2, Duration.ofMinutes(10));

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
                        new TripMonitor.Action("completeTrip", null)))));
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
    void repeatedFramesCannotConfirmAMoveAndMissingShapesCannotMeanDeparture() {
        UUID tripId = tripWithTruck("TEST-123");
        GeofenceSignals checked = new GeofenceSignals(live, geofences,
                (tenantCode, id, kind, fence, time) -> {}, tx, Clock.systemUTC(), true, 2, Duration.ZERO);
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

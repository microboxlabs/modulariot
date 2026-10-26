package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.AuditEvent;
import com.microboxlabs.miot.fleet.resources.domain.Carrier;
import com.microboxlabs.miot.fleet.resources.domain.Driver;
import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.FeedService;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.MandateLine;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripCargoLink;
import com.microboxlabs.miot.fleet.resources.domain.Truck;
import com.microboxlabs.miot.fleet.resources.service.FleetResourcesService;
import com.microboxlabs.miot.trips.service.TripLiveProjector;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Runs the trips Postgres stores against a real database, triggers included. Skipped
 * unless {@code -Dmiot.trips.test.pg-url=postgresql://user:password@host:port/db}
 * is set; the database's {@code miot_trips} schema is dropped and re-created, so
 * use a scratch database. Each test uses its own tenant.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgTripsStoresTest {

    static final String URL_PROPERTY = "miot.trips.test.pg-url";
    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String ACTOR = "feed:test";

    private static Vertx vertx;
    private static Pool pool;

    private final PgMandateStore mandates = new PgMandateStore(() -> pool);
    private final PgCargoStore cargo = new PgCargoStore(() -> pool);
    private final PgTripStore trips = new PgTripStore(() -> pool);
    private final PgStageStore stages = new PgStageStore(() -> pool);
    private final PgAssignmentStore assignments = new PgAssignmentStore(() -> pool);
    private final PgTripCargoStore tripCargo = new PgTripCargoStore(() -> pool);
    private final com.microboxlabs.miot.fleet.resources.store.PgResourceStore resources =
            new com.microboxlabs.miot.fleet.resources.store.PgResourceStore(() -> pool);
    private final PgLocationStore locations = new PgLocationStore(() -> pool);
    private final PgTripLiveStore live = new PgTripLiveStore(() -> pool);
    private final PgAuditStore audit = new PgAuditStore(() -> pool);
    private final TripLiveProjector projector = projector(() -> pool);

    /** The projector over the Postgres stores, fleet included. */
    static TripLiveProjector projector(Supplier<Pool> pool) {
        return new TripLiveProjector(new PgTripStore(pool), new PgStageStore(pool), new PgAssignmentStore(pool),
                new PgCargoStore(pool), new PgLocationStore(pool), new PgTripLiveStore(pool),
                new FleetResourcesService(new com.microboxlabs.miot.fleet.resources.store.PgResourceStore(pool)));
    }

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(URL_PROPERTY)))
                .using(vertx).build();
        PgTripsStoresTest.recreateSchemas(pool);
    }

    /** The fleet and trips migrations, in Flyway order. */
    private static final String[] MIGRATIONS = {
            "/db/migration/fleet/V0.9.0__create_fleet_directory.sql",
            "/db/migration/fleet/V0.9.9__create_fleet_resources.sql",
            "/db/migration/fleet/V0.9.10__updated_at_in_stores.sql",
            "/db/migration/trips/V0.10.0__create_trips.sql",
            "/db/migration/trips/V0.10.3__trips_lock_order.sql",
            "/db/migration/trips/V0.10.4__checks_in_services.sql",
            "/db/migration/trips/V0.10.5__side_effects_in_services.sql",
            "/db/migration/trips/V0.10.6__trip_live_in_services.sql",
            "/db/migration/trips/V0.10.7__updated_at_in_stores.sql",
            "/db/migration/trips/V0.10.8__create_feeds.sql",
            "/db/migration/trips/V0.10.9__values_in_english.sql",
            "/db/migration/trips/V0.10.10__create_monitors.sql",
            "/db/migration/trips/V0.10.11__monitors_on_trips.sql",
            "/db/migration/trips/V0.10.12__location_geofences.sql",
            "/db/migration/trips/V0.10.13__feeds_plan_only.sql",
            "/db/migration/trips/V0.10.14__trip_milestones.sql",
            "/db/migration/trips/V0.10.15__backfill_english_projections.sql",
            "/db/migration/trips/V0.10.17__feed_applied_desired.sql",
            "/db/migration/trips/V0.10.18__milestone_confirmers.sql",
            "/db/migration/trips/V0.10.19__presentation_validation_milestones.sql",
            "/db/migration/trips/V0.10.20__create_deliveries.sql",
            "/db/migration/trips/V0.10.21__create_trip_documents.sql"};

    /** Drops and re-creates the miot_fleet and miot_trips schemas and the content table. Every Pg test starts here. */
    static void recreateSchemas(Pool pool) throws IOException {
        recreateSchemas(pool, MIGRATIONS.length);
    }

    /** Drops the schemas and applies the first {@code count} migrations. */
    static void recreateSchemas(Pool pool, int count) throws IOException {
        pool.query("DROP SCHEMA IF EXISTS miot_trips CASCADE").execute().await().atMost(WAIT);
        pool.query("DROP SCHEMA IF EXISTS miot_fleet CASCADE").execute().await().atMost(WAIT);
        pool.query("CREATE SCHEMA IF NOT EXISTS miot_core").execute().await().atMost(WAIT);
        pool.query("DROP TABLE IF EXISTS miot_core.content").execute().await().atMost(WAIT);
        migrate(pool, "/db/migration/core/V0.1.20__create_content.sql");
        pool.query("DROP SCHEMA IF EXISTS miot_iam CASCADE").execute().await().atMost(WAIT);
        pool.query("CREATE SCHEMA miot_iam").execute().await().atMost(WAIT);
        pool.query("CREATE TABLE miot_iam.iam_team (id UUID PRIMARY KEY)").execute().await().atMost(WAIT);
        for (int i = 0; i < count; i++) {
            migrate(pool, MIGRATIONS[i]);
        }
    }

    static void migrate(Pool pool, String resource) throws IOException {
        try (InputStream in = PgTripsStoresTest.class.getResourceAsStream(resource)) {
            pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
        }
    }

    static int migrationCount() {
        return MIGRATIONS.length;
    }

    /** The number of migrations that come before {@code resource}. */
    static int migrationsBefore(String resource) {
        int i = java.util.Arrays.asList(MIGRATIONS).indexOf(resource);
        if (i < 0) {
            throw new IllegalArgumentException(resource + " is not a migration");
        }
        return i;
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    private static String tenant() {
        return "t-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private Mandate mandate(String tenant, String code) {
        return mandates.insertOrGet(new Mandate(null, tenant, code, "oc", null, Mandate.ACTIVE,
                null, null, null, null, null, null, ACTOR, null, ACTOR)).mandate();
    }

    @Test
    void mandateIsCreateOrReturnAndComesWithItsLine() {
        String tenant = tenant();
        MandateStore.CreateOrGet first = mandates.insertOrGet(new Mandate(null, tenant, "OC-1", "oc", null,
                Mandate.ACTIVE, null, null, null, null, null, null, ACTOR, null, ACTOR));
        MandateStore.CreateOrGet again = mandates.insertOrGet(new Mandate(null, tenant, "OC-1", "oc", null,
                Mandate.ACTIVE, null, null, null, null, null, null, ACTOR, null, ACTOR));

        assertTrue(first.created());
        assertFalse(again.created());
        assertEquals(first.mandate().id(), again.mandate().id());
        MandateLine line = mandates.lineOf(tenant, UUID.fromString(first.mandate().id())).orElseThrow();
        assertEquals(1, line.seq());
        assertTrue(mandates.find("other-tenant", UUID.fromString(first.mandate().id())).isEmpty());
    }

    @Test
    void cargoNumbersItsPartialsAndMountsOnce() {
        String tenant = tenant();
        Mandate m = mandate(tenant, "OC-2");
        MandateLine line = mandates.lineOf(tenant, UUID.fromString(m.id())).orElseThrow();
        CargoUnit c1 = cargo.insert(new CargoUnit(null, tenant, line.id(), 0, "Pallets", new BigDecimal("20"),
                "pallet", null, null, CargoUnit.ANNOUNCED, null, null, null, null, ACTOR, null, ACTOR));
        CargoUnit c2 = cargo.insert(new CargoUnit(null, tenant, line.id(), 0, "Saldo", new BigDecimal("8"),
                "pallet", null, null, CargoUnit.READY, null, null, null, null, ACTOR, null, ACTOR));
        assertEquals(1, c1.partialNo());
        assertEquals(2, c2.partialNo());

        Trip trip = trips.insert(new Trip(null, tenant, Trip.PLANNED, null, null, null, null, null, null,
                null, ACTOR, null, ACTOR));
        UUID tripId = UUID.fromString(trip.id());
        trips.linkMandate(tenant, tripId, UUID.fromString(m.id()), 1, "primary", ACTOR);
        TripCargoLink mounted = tripCargo.insert(new TripCargoLink(trip.id(), c1.id(), tenant, null, null,
                null, ACTOR, null, ACTOR)).orElseThrow();
        assertNotNull(mounted.createdAt());
        assertTrue(tripCargo.insert(new TripCargoLink(trip.id(), c1.id(), tenant, null, null,
                null, ACTOR, null, ACTOR)).isEmpty(), "second mount of the same cargo returns empty");
        assertEquals(List.of(m.id()),
                trips.mandatesOf(tenant, tripId).stream().map(r -> r.mandateId()).toList());
        assertEquals(1, trips.cargoOfMandateOnTrip(tenant, tripId, UUID.fromString(m.id())));
        assertEquals(1, cargo.listByTrip(tenant, tripId).size());
    }

    @Test
    void onlyOneStageRunsAndClosingMovesTheCargo() {
        String tenant = tenant();
        Mandate m = mandate(tenant, "OC-3");
        MandateLine line = mandates.lineOf(tenant, UUID.fromString(m.id())).orElseThrow();
        CargoUnit unit = cargo.insert(new CargoUnit(null, tenant, line.id(), 0, "Carga", null, null, null,
                null, CargoUnit.READY, null, null, null, null, ACTOR, null, ACTOR));
        Trip trip = trips.insert(new Trip(null, tenant, Trip.PLANNED, null, null, null, null, null, null,
                null, ACTOR, null, ACTOR));
        Stage load = stages.insert(new Stage(null, tenant, Stage.SUBJECT_TRIP, trip.id(), 0, "loading", null,
                Stage.PENDING, null, null, null, null, null, null, null, ACTOR, null, ACTOR));
        Stage unload = stages.insert(new Stage(null, tenant, Stage.SUBJECT_TRIP, trip.id(), 0, "unloading", null,
                Stage.PENDING, null, null, null, null, null, null, null, ACTOR, null, ACTOR));
        assertEquals(1, load.seq());
        assertEquals(2, unload.seq());
        tripCargo.insert(new TripCargoLink(trip.id(), unit.id(), tenant, load.id(), unload.id(),
                null, ACTOR, null, ACTOR)).orElseThrow();

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        UUID loadId = UUID.fromString(load.id());
        UUID unloadId = UUID.fromString(unload.id());
        Stage started = stages.start(tenant, loadId, now, ACTOR).orElseThrow();
        assertEquals(Stage.RUNNING, started.status());
        assertThrows(IllegalStateException.class, () -> stages.start(tenant, unloadId, now, ACTOR),
                "the partial unique index allows one running stage per subject");

        stages.close(tenant, loadId, now, ACTOR).orElseThrow();
        assertEquals(1, tripCargo.markLoadedByStage(tenant, loadId, ACTOR));
        assertEquals(CargoUnit.PICKED, cargo.find(tenant, UUID.fromString(unit.id())).orElseThrow().status());
        stages.start(tenant, unloadId, now, ACTOR).orElseThrow();
        stages.close(tenant, unloadId, now, ACTOR).orElseThrow();
        assertEquals(1, tripCargo.markDeliveredByStage(tenant, unloadId, ACTOR));
        assertEquals(CargoUnit.DELIVERED,
                cargo.find(tenant, UUID.fromString(unit.id())).orElseThrow().status());
    }

    @Test
    void fleetKnowsARealTruckAndItsAssignmentWindowEndsOnce() {
        String tenant = tenant();
        Trip trip = trips.insert(new Trip(null, tenant, Trip.PLANNED, null, null, null, null, null, null,
                null, ACTOR, null, ACTOR));
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        assertFalse(resources.isCurrent(tenant, "truck", UUID.randomUUID()), "an unknown truck is not current");

        Carrier carrier = resources.insertCarrier(new Carrier(null, tenant, null, "76.111.222-3",
                "Transportes Test", null, null, null, null, null, Carrier.ACTIVE, false, null, null,
                null, ACTOR, null, ACTOR));
        Truck truck = resources.insertTruck(new Truck(null, tenant, carrier.id(), null, "PLKV-12", null,
                null, null, null, Carrier.ACTIVE, false, null, null, null, ACTOR, null, ACTOR));
        assertTrue(resources.isCurrent(tenant, "truck", UUID.fromString(truck.id())));
        assertFalse(resources.isCurrent(tenant(), "truck", UUID.fromString(truck.id())),
                "another tenant does not see it");
        Truck parked = resources.insertTruck(new Truck(null, tenant, carrier.id(), null, "PLKV-13", null,
                null, null, null, Carrier.INACTIVE, false, null, null, null, ACTOR, null, ACTOR));
        assertFalse(resources.isCurrent(tenant, "truck", UUID.fromString(parked.id())),
                "an inactive truck cannot be assigned");
        Assignment a = assignments.insert(new Assignment(null, tenant, trip.id(), Assignment.TRUCK,
                truck.id(), now, null, null, null, ACTOR, null, ACTOR));
        Assignment ended = assignments.end(tenant, UUID.fromString(a.id()), now.plusHours(1), "panne", ACTOR)
                .orElseThrow();
        assertNotNull(ended.validTo());
        assertTrue(assignments.end(tenant, UUID.fromString(a.id()), now.plusHours(2), null, ACTOR).isEmpty(),
                "an ended window does not end twice");
        assertEquals(1, assignments.listByTrip(tenant, UUID.fromString(trip.id())).size());
    }

    @Test
    void fleetFindsAResourceByItsPlateOrDocumentInAnyWriting() {
        String tenant = tenant();
        FleetResourcesService fleet = new FleetResourcesService(resources);
        Carrier carrier = resources.insertCarrier(new Carrier(null, tenant, null, "20000000001",
                "Transportes Test", null, null, null, null, null, Carrier.ACTIVE, false, null, null,
                null, ACTOR, null, ACTOR));
        Truck truck = resources.insertTruck(new Truck(null, tenant, carrier.id(), null, "ABC-123", null,
                null, null, null, Carrier.ACTIVE, false, null, null, null, ACTOR, null, ACTOR));
        resources.insertTruck(new Truck(null, tenant, carrier.id(), null, "JKL-000", null,
                null, null, null, Carrier.INACTIVE, false, null, null, null, ACTOR, null, ACTOR));
        Driver driver = resources.insertDriver(new Driver(null, tenant, carrier.id(), null, "11.111.111-1",
                null, null, "Conductor Uno", null, null, null, null, Carrier.ACTIVE, false, null, null, null,
                ACTOR, null, ACTOR));

        assertEquals(UUID.fromString(truck.id()), fleet.byPlate(tenant, "truck", "abc 123").orElseThrow().id());
        assertTrue(fleet.byPlate(tenant, "truck", "ABC123").orElseThrow().active());
        assertFalse(fleet.byPlate(tenant, "truck", "JKL-000").orElseThrow().active(), "found, but switched off");
        assertTrue(fleet.byPlate(tenant, "trailer", "ABC-123").isEmpty(), "a truck plate is not a trailer");
        assertTrue(fleet.byPlate(tenant(), "truck", "ABC-123").isEmpty(), "another tenant does not see it");
        assertTrue(fleet.byPlate(tenant, "truck", " - ").isEmpty(), "a blank plate finds nothing");
        assertEquals(UUID.fromString(driver.id()), fleet.driverByDocument(tenant, "111111111").orElseThrow().id());
        Truck unicode = resources.insertTruck(new Truck(null, tenant, carrier.id(), null, "ı-12", null,
                null, null, null, Carrier.ACTIVE, false, null, null, null, ACTOR, null, ACTOR));
        assertEquals(UUID.fromString(unicode.id()), fleet.byPlate(tenant, "truck", "ı-12").orElseThrow().id());
    }

    @Test
    void aFeedKeepsItsProfileAndTheLastStateOfEachService() {
        String tenant = tenant();
        PgFeedStore feeds = new PgFeedStore(() -> pool);
        FeedProfile saved = feeds.saveProfile(new FeedProfile(tenant, "servicios", "Servicios",
                List.of(new FeedProfile.StagePlan("preparation", "ADDED"),
                        new FeedProfile.StagePlan("transit", "SCHEDULED"),
                        new FeedProfile.StagePlan("closing", "FINISHED")),
                "closing", null, new LinkedHashSet<>(List.of("truck", "driver")), true,
                null, ACTOR, null, ACTOR));
        assertEquals("closing", saved.arrivalStage());
        assertEquals(List.of("preparation", "transit", "closing"),
                saved.stages().stream().map(FeedProfile.StagePlan::stageType).toList());
        assertEquals(Set.of("truck", "driver"), saved.requiredResources());
        FeedProfile renamed = feeds.saveProfile(new FeedProfile(tenant, "servicios", "Servicios v2",
                saved.stages(), "closing", "direct", saved.requiredResources(), true, null, ACTOR, null, ACTOR));
        assertEquals("direct", renamed.monitor());
        assertEquals(1, feeds.profiles(tenant).size(), "saving again replaces the profile");

        feeds.saveService(new FeedService(tenant, "servicios", "S-001", "{\"orderRef\":\"a\"}", "h1",
                null, null, true, null, null, null, null));
        OffsetDateTime at = OffsetDateTime.now(ZoneOffset.UTC).withNano(0);
        String trip = UUID.randomUUID().toString();
        feeds.saveService(new FeedService(tenant, "servicios", "S-001", "{\"orderRef\":\"b\"}", "h2",
                null, trip, true, "create", "{\"done\":[\"create trip\"]}", at, "{\"orderRef\":\"b\"}"));
        FeedService s = feeds.service(tenant, "servicios", "S-001").orElseThrow();
        assertEquals("h2", s.desiredHash());
        assertEquals(trip, s.tripId());
        assertTrue(s.desired().contains("\"b\""));
    }

    @Test
    void feedAuditActorsAndJsonTypesArePreserved() {
        String tenant = tenant();
        PgFeedStore feeds = new PgFeedStore(() -> pool);
        FeedProfile profile = new FeedProfile(tenant, "test-feed", "Test feed",
                List.of(new FeedProfile.StagePlan("preparacion", "ADDED")),
                "preparacion", null, Set.of(), true, null, "creator", null, null);
        FeedProfile created = feeds.saveProfile(profile);
        assertEquals("creator", created.createdBy());
        FeedProfile updated = feeds.saveProfile(new FeedProfile(tenant, "test-feed", "Updated feed",
                profile.stages(), "preparacion", null, Set.of(), true,
                null, "ignored-creator", null, "updater"));
        assertEquals("creator", updated.createdBy());
        assertEquals("updater", updated.updatedBy());
        feeds.saveService(new FeedService(tenant, "test-feed", "S-TEST", "{\"value\":1}", "hash",
                null, null, true, "test", "{\"ok\":true}", null, null));
        var rows = pool.preparedQuery("""
                SELECT jsonb_typeof(stages) AS kind FROM miot_trips.feed_profile WHERE tenant_code = $1
                UNION ALL SELECT jsonb_typeof(desired) FROM miot_trips.feed_service WHERE tenant_code = $1
                UNION ALL SELECT jsonb_typeof(last_result) FROM miot_trips.feed_service WHERE tenant_code = $1
                """).execute(io.vertx.mutiny.sqlclient.Tuple.of(tenant)).await().atMost(WAIT);
        assertEquals(List.of("array", "object", "object"),
                rows.stream().map(row -> row.getString("kind")).toList());
    }

    @Test
    void unmountIsLogicalAndRemountWorks() {
        String tenant = tenant();
        Mandate m = mandate(tenant, "OC-REMOUNT");
        MandateLine line = mandates.lineOf(tenant, UUID.fromString(m.id())).orElseThrow();
        CargoUnit unit = cargo.insert(new CargoUnit(null, tenant, line.id(), 0, "Carga", null, null, null,
                null, CargoUnit.READY, null, null, null, null, ACTOR, null, ACTOR));
        Trip trip = trips.insert(new Trip(null, tenant, Trip.PLANNED, null, null, null, null, null, null,
                null, ACTOR, null, ACTOR));
        UUID tripId = UUID.fromString(trip.id());
        UUID cargoId = UUID.fromString(unit.id());

        tripCargo.insert(new TripCargoLink(trip.id(), unit.id(), tenant, null, null,
                null, ACTOR, null, ACTOR)).orElseThrow();
        assertTrue(tripCargo.delete(tenant, tripId, cargoId), "unmount marks the link inactive");
        assertTrue(tripCargo.find(tenant, tripId, cargoId).isEmpty(), "an inactive link is not current");
        assertFalse(tripCargo.delete(tenant, tripId, cargoId), "nothing current left to unmount");
        // the partial unique only guards current+active links, so remounting works
        assertTrue(tripCargo.insert(new TripCargoLink(trip.id(), unit.id(), tenant, null, null,
                null, ACTOR, null, ACTOR)).isPresent(), "remount after a logical unmount");
    }

    @Test
    void theHotRowIsBornWithTheTripAndDiesWhenItEnds() {
        String tenant = tenant();
        Trip trip = trips.insert(new Trip(null, tenant, Trip.PLANNED, null, null, null, null, null, null,
                null, ACTOR, null, ACTOR));
        UUID tripId = UUID.fromString(trip.id());
        projector.refresh(tenant, tripId);
        assertTrue(live.find(tenant, tripId).isPresent(), "the projection is born with the trip");
        projector.refresh(tenant, tripId);
        assertEquals(1, live.list(tenant).size(), "a second refresh replaces the row");

        trips.update(new Trip(trip.id(), tenant, Trip.DONE, null, null, null, null,
                OffsetDateTime.now(ZoneOffset.UTC), null, trip.createdAt(), trip.createdBy(), null, ACTOR));
        projector.refresh(tenant, tripId);
        assertTrue(live.find(tenant, tripId).isEmpty(), "completed kills the hot row");
    }

    @Test
    void locationsAndAuditKeepTheirTenantAndOrder() {
        String tenant = tenant();
        Location planta = locations.insert(new Location(null, tenant, "Planta Talca", "plant", "PL-01",
                null, null, ACTOR, null, ACTOR));
        locations.update(new Location(planta.id(), tenant, "Planta Talca", "plant", "PL-01-B", null,
                planta.createdAt(), planta.createdBy(), null, ACTOR)).orElseThrow();
        assertEquals("PL-01-B", locations.list(tenant, "Talca", null, 0, 10).get(0).externalCode());
        assertTrue(locations.list("other-tenant", null, null, 0, 10).isEmpty());

        audit.append(new AuditEvent(null, tenant, ACTOR, "mandate.created", "mandate", "x", null,
                Map.of("k", "v"), null));
        audit.append(new AuditEvent(null, tenant, ACTOR, "mandate.closed", "mandate", "x", null, null, null));
        List<AuditEvent> trail = audit.list(tenant, "mandate", "x", null, null, 10);
        assertEquals(2, trail.size());
        assertEquals("mandate.closed", trail.get(0).action());
        assertEquals("v", trail.get(1).details().get("k"));
        List<AuditEvent> page = audit.list(tenant, null, null, trail.get(0).createdAt(), trail.get(0).id(), 10);
        assertEquals(1, page.size());
        assertEquals("mandate.created", page.get(0).action());
    }

    @Test
    void aRefreshAfterARenameShowsTheNewName() {
        String tenant = tenant();
        Location origin = locations.insert(new Location(null, tenant, "Bodega Norte", "distribution_center", "CD-N",
                null, null, ACTOR, null, ACTOR));
        Trip trip = trips.insert(new Trip(null, tenant, Trip.PLANNED, origin.id(), null, null, null, null, null,
                null, ACTOR, null, ACTOR));
        UUID tripId = UUID.fromString(trip.id());
        projector.refresh(tenant, tripId);
        assertEquals("Bodega Norte", live.find(tenant, tripId).orElseThrow().originGeofenceLabel());

        locations.update(new Location(origin.id(), tenant, "Bodega Norte 2", "distribution_center", "CD-N", null,
                origin.createdAt(), origin.createdBy(), null, ACTOR)).orElseThrow();
        assertEquals(List.of(tripId), trips.openTripsAt(tenant, UUID.fromString(origin.id())));
        projector.refreshAll(tenant, trips.openTripsAt(tenant, UUID.fromString(origin.id())));
        assertEquals("Bodega Norte 2", live.find(tenant, tripId).orElseThrow().originGeofenceLabel());
    }

    @Test
    void anUpdateStampsUpdatedAt() {
        String tenant = tenant();
        Trip trip = trips.insert(new Trip(null, tenant, Trip.PLANNED, null, null, null, null, null, null,
                null, ACTOR, null, ACTOR));
        Trip moved = trips.update(new Trip(trip.id(), tenant, Trip.PLANNED, null, null,
                OffsetDateTime.now(ZoneOffset.UTC).plusDays(1), null, null, null, null, ACTOR, null, ACTOR))
                .orElseThrow();
        assertTrue(moved.updatedAt().isAfter(trip.updatedAt()), "the store stamps updated_at on UPDATE");
        assertEquals(trip.createdAt(), moved.createdAt());
        Stage stage = stages.insert(new Stage(null, tenant, Stage.SUBJECT_TRIP, trip.id(), 0, "loading", null,
                Stage.PENDING, null, null, null, null, null, null, null, ACTOR, null, ACTOR));
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Stage started = stages.start(tenant, UUID.fromString(stage.id()), now, ACTOR).orElseThrow();
        assertTrue(started.updatedAt().isAfter(stage.updatedAt()), "a stage start stamps updated_at");
        Stage closed = stages.close(tenant, UUID.fromString(stage.id()), now, ACTOR).orElseThrow();
        assertTrue(closed.updatedAt().isAfter(started.updatedAt()), "a stage close stamps updated_at");

        Carrier carrier = resources.insertCarrier(new Carrier(null, tenant, null, "76.333.444-5",
                "Transportes Fecha", null, null, null, null, null, Carrier.ACTIVE, false, null, null,
                null, ACTOR, null, ACTOR));
        Truck truck = resources.insertTruck(new Truck(null, tenant, carrier.id(), null, "FECH-01", null,
                null, null, null, Carrier.ACTIVE, false, null, null, null, ACTOR, null, ACTOR));
        Truck renamed = resources.updateTruck(new Truck(truck.id(), tenant, carrier.id(), null, "FECH-02", null,
                null, null, null, Carrier.ACTIVE, false, null, null, null, ACTOR, null, ACTOR)).orElseThrow();
        assertTrue(renamed.updatedAt().isAfter(truck.updatedAt()), "the fleet store stamps updated_at too");
    }

    @Test
    void anUnchangedUpdateArchivesNothing() {
        String tenant = tenant();
        Trip trip = trips.insert(new Trip(null, tenant, Trip.PLANNED, null, null, null, null, null, null,
                null, ACTOR, null, ACTOR));
        trips.update(trip).orElseThrow();
        assertEquals(0, versionsOf(trip.id()), "a re-sent trip leaves no history");
        trips.update(new Trip(trip.id(), tenant, Trip.PLANNED, null, null,
                OffsetDateTime.now(ZoneOffset.UTC).plusDays(1), null, null, null, null, ACTOR, null, ACTOR))
                .orElseThrow();
        assertEquals(1, versionsOf(trip.id()), "a real change archives the previous version");
    }

    @Test
    void aMandateStatusAndTheMandateOfACargoAreReadBack() {
        String tenant = tenant();
        Mandate m = mandate(tenant, "OC-CANCEL");
        mandates.update(new Mandate(m.id(), tenant, m.externalCode(), m.orderType(), m.orderRef(), "cancelled",
                null, null, null, OffsetDateTime.now(ZoneOffset.UTC), "cliente anula", m.createdAt(), ACTOR,
                null, ACTOR)).orElseThrow();
        UUID mandateId = UUID.fromString(m.id());
        assertEquals("cancelled", mandates.statusForLink(tenant, mandateId).orElseThrow());
        assertTrue(mandates.statusForLink(tenant(), mandateId).isEmpty(), "another tenant does not see it");

        MandateLine line = mandates.lineOf(tenant, mandateId).orElseThrow();
        CargoUnit unit = cargo.insert(new CargoUnit(null, tenant, line.id(), 0, "Carga", null, null, null,
                null, CargoUnit.READY, null, null, null, null, ACTOR, null, ACTOR));
        assertEquals(mandateId, cargo.mandateOf(tenant, UUID.fromString(unit.id())).orElseThrow());
    }

    private long versionsOf(String id) {
        return pool.preparedQuery("SELECT count(*) FROM miot_trips.trip WHERE version_of = $1")
                .execute(io.vertx.mutiny.sqlclient.Tuple.of(UUID.fromString(id))).await().atMost(WAIT)
                .iterator().next().getLong(0);
    }

    @Test
    void jsonColumnsHoldObjectsNotStrings() {
        String tenant = tenant();
        audit.append(new AuditEvent(null, tenant, ACTOR, "mandate.created", "mandate", "j", null,
                Map.of("k", "v"), null));
        Trip trip = trips.insert(new Trip(null, tenant, Trip.PLANNED, null, null, null, null, null, null,
                null, ACTOR, null, ACTOR));
        stages.insert(new Stage(null, tenant, Stage.SUBJECT_TRIP, trip.id(), 0, "loading", null,
                Stage.PENDING, null, null, null, null, null, "{\"items\":[\"sello\"]}", null, ACTOR, null, ACTOR));
        locations.insert(new Location(null, tenant, "Puerto", "port", "PU-01",
                "{\"type\":\"Point\",\"coordinates\":[-71.6,-33.0]}", null, ACTOR, null, ACTOR));

        List<String> types = pool.preparedQuery("""
                SELECT jsonb_typeof(details) FROM miot_trips.audit_event WHERE tenant_code = $1
                UNION ALL SELECT jsonb_typeof(checklist) FROM miot_trips.stage WHERE tenant_code = $1
                UNION ALL SELECT jsonb_typeof(geom_geojson) FROM miot_trips.location WHERE tenant_code = $1""")
                .execute(io.vertx.mutiny.sqlclient.Tuple.of(tenant)).await().atMost(WAIT)
                .stream().map(r -> r.getString(0)).toList();
        assertEquals(List.of("object", "object", "object"), types);
    }
}

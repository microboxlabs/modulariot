package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.fleet.resources.domain.Carrier;
import com.microboxlabs.miot.fleet.resources.domain.Driver;
import com.microboxlabs.miot.fleet.resources.domain.Trailer;
import com.microboxlabs.miot.fleet.resources.domain.Truck;
import com.microboxlabs.miot.fleet.resources.dto.CarrierRequest;
import com.microboxlabs.miot.fleet.resources.dto.DriverRequest;
import com.microboxlabs.miot.fleet.resources.dto.TrailerRequest;
import com.microboxlabs.miot.fleet.resources.dto.TruckRequest;
import com.microboxlabs.miot.fleet.resources.service.ResourceService;
import com.microboxlabs.miot.fleet.resources.store.PgResourceStore;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.StageActivity;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.dto.ActivityRequest;
import com.microboxlabs.miot.trips.dto.AssignmentRequest;
import com.microboxlabs.miot.trips.dto.CargoRequest;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.service.AssignmentService;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.CargoService;
import com.microboxlabs.miot.fleet.resources.service.FleetResourcesService;
import com.microboxlabs.miot.trips.service.TripLiveProjector;
import com.microboxlabs.miot.trips.service.MandateService;
import com.microboxlabs.miot.trips.service.MilestoneService;
import com.microboxlabs.miot.trips.service.StageService;
import com.microboxlabs.miot.trips.service.TripService;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Atomicity and locking of the trips operations against a real database. Skipped unless
 * {@code -Dmiot.trips.test.pg-url=…} is set; drops and re-creates the {@code miot_trips} schema,
 * so use a scratch database.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgTransactionsTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String ACTOR = "feed:test";

    private static Vertx vertx;
    private static Pool pool;

    private final Transactions tx = new PgTransactions(() -> pool);
    private final AuditService audit = new AuditService(new PgAuditStore(() -> pool));
    private final PgTripStore tripStore = new PgTripStore(() -> pool);
    private final MandateService mandates = new MandateService(new PgMandateStore(() -> pool), audit, tx);
    private final TripLiveProjector projector = PgTripsStoresTest.projector(() -> pool);
    private final CargoService cargo = new CargoService(new PgCargoStore(() -> pool), mandates, projector, audit,
            tx);
    private final TripService trips = new TripService(tripStore, new PgStageStore(() -> pool),
            new PgAssignmentStore(() -> pool), new PgTripCargoStore(() -> pool), new PgCargoStore(() -> pool),
            mandates, projector, audit, tx);
    private final StageService stages = new StageService(new PgStageStore(() -> pool), tripStore,
            new PgTripCargoStore(() -> pool), mandates, projector, audit, tx);
    private final PgResourceStore fleetStore = new PgResourceStore(() -> pool);
    private final Transactions fleetTx =
            new PgTransactions(() -> pool);
    private final ResourceService fleet = new ResourceService(fleetStore, fleetTx);
    private final AssignmentService assignments = new AssignmentService(new PgAssignmentStore(() -> pool),
            tripStore, new FleetResourcesService(fleetStore), projector, audit, tx);

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty(PgTripsStoresTest.URL_PROPERTY)))
                .with(new PoolOptions().setMaxSize(12))
                .using(vertx).build();
        PgTripsStoresTest.recreateSchemas(pool);
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    private static String tenant() {
        return "tx-" + UUID.randomUUID();
    }

    @Test
    void aRefusedCreateLeavesNoTrip() {
        String tenant = tenant();
        // the second stage passes validation but fails in the database (no such location)
        TripRequest request = new TripRequest(null, null, null, null, List.of(
                new StageRequest("loading", null, null, null, null, null),
                new StageRequest("unloading", null, UUID.randomUUID().toString(), null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> trips.create(tenant, ACTOR, request));

        assertTrue(trips.list(tenant, TripService.filter(null, null, null, null, null), 0, 50).isEmpty(),
                "the trip inserted before the failing stage was rolled back");
    }

    @Test
    void concurrentAnnouncementsTakeConsecutivePartials() throws Exception {
        String tenant = tenant();
        UUID mandateId = UUID.fromString(mandates.createOrGet(tenant, ACTOR,
                new MandateRequest("OC-TX-1", "oc", null, null, null, null)).mandate().id());
        int n = 8;
        ExecutorService pool8 = Executors.newFixedThreadPool(n);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<CargoUnit>> results = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            results.add(pool8.submit(() -> {
                go.await();
                return cargo.announce(tenant, ACTOR, mandateId,
                        new CargoRequest("Pallet", null, null, null, null, null));
            }));
        }
        go.countDown();
        Set<Integer> partials = new TreeSet<>();
        for (Future<CargoUnit> f : results) {
            partials.add(f.get(30, TimeUnit.SECONDS).partialNo());
        }
        pool8.shutdown();

        assertEquals(Set.of(1, 2, 3, 4, 5, 6, 7, 8), partials, "every announcement got its own number, no 409");
    }

    @Test
    void concurrentMilestoneReportsKeepEverySourcesEvidence() throws Exception {
        String tenant = tenant();
        UUID tripId = UUID.fromString(trips.create(tenant, ACTOR,
                new TripRequest(null, null, null, null, List.of())).id());
        PgMilestoneStore milestoneStore = new PgMilestoneStore(() -> pool);
        MilestoneService milestones = new MilestoneService(milestoneStore, tripStore, audit, tx);
        Map<String, Object> expected = new java.util.HashMap<>();
        CountDownLatch go = new CountDownLatch(1);
        try (ExecutorService workers = Executors.newFixedThreadPool(8)) {
            List<Future<?>> reports = new ArrayList<>();
            for (int i = 0; i < 8; i++) {
                Map<String, Object> evidence = Map.of("source" + i, "ok");
                expected.putAll(evidence);
                reports.add(workers.submit(() -> {
                    go.await();
                    return milestones.detect(tenant, ACTOR, tripId, "presentation", "test", null, evidence);
                }));
            }
            go.countDown();
            for (Future<?> report : reports) {
                report.get(30, TimeUnit.SECONDS);
            }
        }
        assertEquals(expected, milestoneStore.find(tenant, tripId, "presentation").orElseThrow().evidence());
    }

    @Test
    void aReadInsideATransactionHoldsTheRowUntilItEnds() throws Exception {
        String tenant = tenant();
        UUID tripId = UUID.fromString(trips.create(tenant, ACTOR, new TripRequest(null, null, null, null,
                List.of(new StageRequest("loading", null, null, null, null, null)))).id());
        UUID stageId = UUID.fromString(stages.listByTrip(tenant, tripId).get(0).id());
        CountDownLatch read = new CountDownLatch(1);
        ExecutorService other = Executors.newSingleThreadExecutor();

        // a read-modify-write of the trip that pauses between its read and its write
        Future<?> patch = other.submit(() -> tx.inTransaction(() -> {
            Trip t = tripStore.find(tenant, tripId).orElseThrow();
            read.countDown();
            sleep(500);
            tripStore.update(new Trip(t.id(), tenant, t.status(), t.originId(), t.destinationId(),
                    t.plannedStart(), t.actualStart(), t.actualEnd(), t.cancelReason(),
                    t.createdAt(), t.createdBy(), null, ACTOR));
        }));
        read.await(10, TimeUnit.SECONDS);
        stages.start(tenant, ACTOR, stageId);
        patch.get(30, TimeUnit.SECONDS);
        other.shutdown();

        assertEquals(Trip.IN_PROGRESS, trips.get(tenant, tripId).status(),
                "the start waited for the patch, so the patch could not write planned back");
    }

    @Test
    void aRefusedCompletionRollsBackTheAssignmentItCreated() {
        String tenant = tenant();
        UUID tripId = UUID.fromString(trips.create(tenant, ACTOR, new TripRequest(null, null, null, null,
                List.of(new StageRequest("preparation", null, null, null, null, null)))).id());
        Stage stage = stages.listByTrip(tenant, tripId).get(0);
        StageActivity activity = stages.addActivity(tenant, ACTOR, UUID.fromString(stage.id()),
                new ActivityRequest("asignar_conductor", null, null, null));
        UUID activityId = UUID.fromString(activity.id());
        stages.completeActivity(tenant, ACTOR, activityId, null, null);
        Driver driver = fleet.createDriver(tenant, ACTOR, new DriverRequest(null, null,
                UUID.randomUUID().toString().substring(0, 12), "Ana", "Rojas", null, null, null, null, null,
                null, false, null));

        // the same unit of work the completion endpoint runs, retried on a finished activity
        assertThrows(IllegalStateException.class, () -> tx.inTransaction(() -> {
            Assignment created = assignments.create(tenant, ACTOR, tripId,
                    new AssignmentRequest("driver", driver.id(), null, null));
            return stages.completeActivity(tenant, ACTOR, activityId, null, created.id());
        }));

        assertTrue(assignments.listByTrip(tenant, tripId).isEmpty(), "the assignment was rolled back");
    }

    @Test
    void anAuditFailureLeavesTheTransactionUsable() {
        String tenant = tenant();
        tx.inTransaction(() -> {
            mandates.createOrGet(tenant, ACTOR, new MandateRequest("OC-AU-1", "oc", null, null, null, null));
            // action is VARCHAR(128): this insert fails, inside the open transaction
            assertNull(audit.log(tenant, ACTOR, "x".repeat(200), "mandate", null, null, Map.of()));
            mandates.createOrGet(tenant, ACTOR, new MandateRequest("OC-AU-2", "oc", null, null, null, null));
        });

        assertEquals(2, mandates.list(tenant, null, null, 0, 50).size(), "both mandates committed");
    }

    @Test
    void aRolledBackOperationLeavesNoAuditEvent() {
        String tenant = tenant();
        assertThrows(IllegalStateException.class, () -> tx.inTransaction(() -> {
            mandates.createOrGet(tenant, ACTOR, new MandateRequest("OC-AU-3", "oc", null, null, null, null));
            throw new IllegalStateException("refused after the audit event was written");
        }));

        assertTrue(mandates.list(tenant, null, null, 0, 50).isEmpty());
        assertTrue(audit.list(tenant, null, null, null, null, 100).isEmpty(), "the event went with the rollback");
    }

    @Test
    void concurrentFleetPatchesKeepBothChanges() throws Exception {
        String tenant = tenant();
        Carrier carrier = fleet.createCarrier(tenant, ACTOR, new CarrierRequest(null, "33333333-3", "Uno SpA",
                null, null, null, null, null, null, false, null));
        Truck truck = fleet.createTruck(tenant, ACTOR, new TruckRequest(carrier.id(), null, "DDDD44", null,
                "tracto", null, null, null, false, null));
        Trailer trailer = fleet.createTrailer(tenant, ACTOR, new TrailerRequest(carrier.id(), null, "EEEE55",
                null, "rampla", null, null, false, null));
        Driver driver = fleet.createDriver(tenant, ACTOR, new DriverRequest(carrier.id(), null, "44444444-4",
                "Ana", "Rojas", null, null, null, null, null, null, false, null));
        UUID cid = UUID.fromString(carrier.id());
        UUID tid = UUID.fromString(truck.id());
        UUID rid = UUID.fromString(trailer.id());
        UUID did = UUID.fromString(driver.id());

        // each race: a writer reads (locked), pauses, and writes its stale copy plus one field,
        // while a PATCH of another field arrives in the pause
        race(() -> fleetStore.findCarrier(tenant, cid).orElseThrow(),
                c -> fleetStore.updateCarrier(new Carrier(c.id(), tenant, c.externalId(), c.rut(), c.legalName(),
                        c.transportLicense(), c.transportLicenseExpires(), "Contacto", c.phone(), c.email(),
                        c.status(), c.isOccasional(), c.sourceSystem(), c.sourceData(), c.createdAt(),
                        c.createdBy(), null, ACTOR)),
                () -> fleet.updateCarrier(tenant, ACTOR, cid,
                        new CarrierRequest(null, null, null, null, null, null, "+56900000002", null, null, null, null)));
        race(() -> fleetStore.findTruck(tenant, tid).orElseThrow(),
                t -> fleetStore.updateTruck(new Truck(t.id(), tenant, t.carrierId(), t.externalId(),
                        t.licensePlate(), "VIN1", t.truckType(), t.maxWeight(), t.volume(), t.status(),
                        t.isOccasional(), t.sourceSystem(), t.sourceData(), t.createdAt(), t.createdBy(), null,
                        ACTOR)),
                () -> fleet.updateTruck(tenant, ACTOR, tid,
                        new TruckRequest(null, null, null, null, "camion", null, null, null, null, null)));
        race(() -> fleetStore.findTrailer(tenant, rid).orElseThrow(),
                t -> fleetStore.updateTrailer(new Trailer(t.id(), tenant, t.carrierId(), t.externalId(),
                        t.licensePlate(), "VIN2", t.trailerType(), t.maxWeight(), t.status(), t.isOccasional(),
                        t.sourceSystem(), t.sourceData(), t.createdAt(), t.createdBy(), null, ACTOR)),
                () -> fleet.updateTrailer(tenant, ACTOR, rid,
                        new TrailerRequest(null, null, null, null, "cama baja", null, null, null, null)));
        race(() -> fleetStore.findDriver(tenant, did).orElseThrow(),
                d -> fleetStore.updateDriver(new Driver(d.id(), tenant, d.carrierId(), d.externalId(), d.rut(),
                        d.firstName(), d.lastName(), d.fullName(), "+56900000003", d.mobilePhone(),
                        d.licenseCategory(), d.licenseExpires(), d.status(), d.isOccasional(), d.sourceSystem(),
                        d.sourceData(), d.createdAt(), d.createdBy(), null, ACTOR)),
                () -> fleet.updateDriver(tenant, ACTOR, did, new DriverRequest(null, null, null, null, null, null,
                        null, "+56900000004", null, null, null, null, null)));

        Carrier c = fleetStore.findCarrier(tenant, cid).orElseThrow();
        assertEquals("Contacto", c.contactName());
        assertEquals("+56900000002", c.phone());
        Truck t = fleetStore.findTruck(tenant, tid).orElseThrow();
        assertEquals("VIN1", t.vin());
        assertEquals("camion", t.truckType());
        Trailer r = fleetStore.findTrailer(tenant, rid).orElseThrow();
        assertEquals("VIN2", r.vin());
        assertEquals("cama baja", r.trailerType());
        Driver d = fleetStore.findDriver(tenant, did).orElseThrow();
        assertEquals("+56900000003", d.phone());
        assertEquals("+56900000004", d.mobilePhone());
    }

    private <T> void race(Supplier<T> lockedRead, Consumer<T> staleWrite, Runnable concurrentPatch)
            throws Exception {
        CountDownLatch read = new CountDownLatch(1);
        ExecutorService other = Executors.newSingleThreadExecutor();
        Future<?> slow = other.submit(() -> fleetTx.inTransaction(() -> {
            T stale = lockedRead.get();
            read.countDown();
            sleep(300);
            staleWrite.accept(stale);
        }));
        read.await(10, TimeUnit.SECONDS);
        concurrentPatch.run();
        slow.get(30, TimeUnit.SECONDS);
        other.shutdown();
    }

    /** Holds the open transaction for {@code ms}, the window in which the other thread must wait. */
    private static void sleep(long ms) {
        try {
            boolean released = new CountDownLatch(1).await(ms, TimeUnit.MILLISECONDS);
            assertFalse(released);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}

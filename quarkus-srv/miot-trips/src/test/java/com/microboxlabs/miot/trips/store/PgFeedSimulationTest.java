package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.fleet.resources.domain.Carrier;
import com.microboxlabs.miot.fleet.resources.domain.Driver;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.fleet.resources.domain.Trailer;
import com.microboxlabs.miot.trips.domain.TripLiveRow;
import com.microboxlabs.miot.fleet.resources.domain.Truck;
import com.microboxlabs.miot.trips.dto.AssignmentRequest;
import com.microboxlabs.miot.trips.dto.CargoRequest;
import com.microboxlabs.miot.fleet.resources.dto.CarrierRequest;
import com.microboxlabs.miot.fleet.resources.dto.DriverRequest;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.dto.ReceiveRequest;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.fleet.resources.dto.TrailerRequest;
import com.microboxlabs.miot.trips.dto.TripCargoRequest;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.dto.TripView;
import com.microboxlabs.miot.fleet.resources.dto.TruckRequest;
import com.microboxlabs.miot.trips.service.AssignmentService;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.CargoService;
import com.microboxlabs.miot.fleet.resources.service.FleetResourcesService;
import com.microboxlabs.miot.trips.service.TripLiveProjector;
import com.microboxlabs.miot.trips.service.MandateService;
import com.microboxlabs.miot.fleet.resources.service.ResourceService;
import com.microboxlabs.miot.trips.service.StageService;
import com.microboxlabs.miot.trips.service.TripCargoService;
import com.microboxlabs.miot.trips.service.TripService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Replays, service-by-service against a real database, the calls the n8n feeds will make:
 * a tenant A service modeled on a real service, a tenant A trip
 * discovered mid-route (the integration can start at any stage), a truck change, and an
 * tenant B purchase order with partials and reception. Skipped unless
 * {@code -Dmiot.trips.test.pg-url=…} is set; drops and re-creates the {@code miot_trips}
 * schema, so use a scratch database.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgFeedSimulationTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";
    private static final String FEED_A = "feed:a";
    private static final String FEED_B = "feed:b";

    private static Vertx vertx;
    private static Pool pool;

    private final AuditService audit = new AuditService(new PgAuditStore(() -> pool));
    private final Transactions tx = new PgTransactions(() -> pool);
    private final MandateService mandates = new MandateService(new PgMandateStore(() -> pool), audit, tx);
    private final TripLiveProjector projector = PgTripsStoresTest.projector(() -> pool);
    private final CargoService cargo = new CargoService(new PgCargoStore(() -> pool), mandates, projector, audit,
            tx);
    private final TripService trips = new TripService(new PgTripStore(() -> pool), new PgStageStore(() -> pool),
            new PgAssignmentStore(() -> pool), new PgTripCargoStore(() -> pool), new PgCargoStore(() -> pool),
            mandates, projector, audit, tx);
    private final StageService stages = new StageService(new PgStageStore(() -> pool),
            new PgTripStore(() -> pool), new PgTripCargoStore(() -> pool), mandates, projector, audit, tx);
    private final ResourceService resources = new ResourceService(
            new com.microboxlabs.miot.fleet.resources.store.PgResourceStore(() -> pool),
            new PgTransactions(() -> pool));
    private final AssignmentService assignments = new AssignmentService(new PgAssignmentStore(() -> pool),
            new PgTripStore(() -> pool),
            new FleetResourcesService(new com.microboxlabs.miot.fleet.resources.store.PgResourceStore(() -> pool)),
            projector, audit, tx);
    private final TripCargoService tripCargo = new TripCargoService(new PgTripCargoStore(() -> pool),
            new PgTripStore(() -> pool), new PgCargoStore(() -> pool), new PgStageStore(() -> pool), mandates,
            projector, audit, tx);
    private final PgTripLiveStore live = new PgTripLiveStore(() -> pool);

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

    private static Fleet tenantAFleet;

    /**
     * The resources the directory feed already loads for tenant A, as the n8n transforms send them.
     * Created once per class: a plate or RUT is unique per tenant.
     */
    private Fleet tenantAFleet() {
        if (tenantAFleet == null) {
            tenantAFleet = createTenantAFleet();
        }
        return tenantAFleet;
    }

    private Fleet createTenantAFleet() {
        Carrier carrier = resources.createCarrier(TENANT_A, FEED_A, new CarrierRequest(null, "11111111-1",
                "TRANSPORTES EJEMPLO SPA", null, null, null, null, null, null, false, "directory-feed"));
        Truck tractor = resources.createTruck(TENANT_A, FEED_A, new TruckRequest(carrier.id(), null, "AAAA11", null,
                "tracto", null, null, null, false, "directory-feed"));
        Truck backup = resources.createTruck(TENANT_A, FEED_A, new TruckRequest(carrier.id(), null, "BBBB22", null,
                "tracto", null, null, null, false, "directory-feed"));
        Trailer rampla = resources.createTrailer(TENANT_A, FEED_A, new TrailerRequest(carrier.id(), null, "CCCC33",
                null, "rampla", null, null, false, "directory-feed"));
        Driver driver = resources.createDriver(TENANT_A, FEED_A, new DriverRequest(carrier.id(), null,
                "22222222-2", "JUAN", "PEREZ SOTO", null, null, "+56900000001", null, null,
                null, false, "directory-feed"));
        return new Fleet(carrier, tractor, backup, rampla, driver);
    }

    private record Fleet(Carrier carrier, Truck truck, Truck backupTruck, Trailer trailer, Driver driver) {
    }

    @Test
    void tenantAServiceRunsLikeTrip1000001WithATruckChange() {
        Fleet fleet = tenantAFleet();

        // 1. the source upsert arrives: n8n decomposes it — mandate first (idempotent)
        MandateService.CreateOrGet first = mandates.createOrGet(TENANT_A, FEED_A,
                new MandateRequest("SRV-1000001", "service", null, null, null, null));
        MandateService.CreateOrGet retry = mandates.createOrGet(TENANT_A, FEED_A,
                new MandateRequest("SRV-1000001", "service", null, null, null, null));
        assertTrue(first.created() && !retry.created(), "an n8n retry returns the same mandate");

        // 2. the trip with the stage plan the integration defines (origin → destination)
        TripView trip = trips.create(TENANT_A, FEED_A, new TripRequest(null, null, null,
                List.of(first.mandate().id()), List.of(
                        new StageRequest("loading", null, null, null, null, null),
                        new StageRequest("transit", null, null, null, null, null),
                        new StageRequest("unloading", null, null, null, null, null),
                        new StageRequest("closing", null, null, null, null, null))));
        UUID tripId = UUID.fromString(trip.id());
        assertTrue(live.find(TENANT_A, tripId).isPresent(), "the hot row is born with the trip (ADDED)");

        // 3. resources, as the upsert names them (SCHEDULED)
        assignments.create(TENANT_A, FEED_A, tripId,
                new AssignmentRequest("truck", fleet.truck().id(), null, null));
        assignments.create(TENANT_A, FEED_A, tripId,
                new AssignmentRequest("trailer", fleet.trailer().id(), null, null));
        Assignment driving = assignments.create(TENANT_A, FEED_A, tripId,
                new AssignmentRequest("driver", fleet.driver().id(), null, null));
        TripLiveRow board = live.find(TENANT_A, tripId).orElseThrow();
        assertEquals("AAAA11", board.assetId());
        assertEquals("CCCC33", board.ramplaPlate());
        assertEquals("22222222-2", board.driverId());
        assertEquals("JUAN PEREZ SOTO", board.driverName());
        assertEquals("+56900000001", board.driverContactPhone());
        assertFalse(board.doubleDriver());
        assertEquals(fleet.carrier().id(), board.carrierId());
        assertEquals("TRANSPORTES EJEMPLO SPA", board.carrierName());
        assertTrue(board.mandateCodes().contains("SRV-1000001"), board.mandateCodes());
        assertEquals("planned", board.status());

        // 4. the stages run; the first start puts the trip and the mandate in_progress
        List<Stage> plan = stages.listByTrip(TENANT_A, tripId);
        stages.start(TENANT_A, FEED_A, UUID.fromString(plan.get(0).id()));
        assertEquals("in_progress", trips.get(TENANT_A, tripId).status());
        assertEquals(Mandate.RUNNING,
                mandates.get(TENANT_A, UUID.fromString(first.mandate().id())).status());
        stages.close(TENANT_A, FEED_A, UUID.fromString(plan.get(0).id()));
        stages.start(TENANT_A, FEED_A, UUID.fromString(plan.get(1).id()));

        // 5. mid-route the truck breaks: end the window, assign the backup — the truck change
        Assignment broken = assignments.listByTrip(TENANT_A, tripId).get(0);
        assignments.end(TENANT_A, FEED_A, UUID.fromString(broken.id()), null, "panne en ruta");
        assignments.create(TENANT_A, FEED_A, tripId,
                new AssignmentRequest("truck", fleet.backupTruck().id(), null, "reemplazo por panne"));
        assertEquals(4, assignments.listByTrip(TENANT_A, tripId).size());
        assertEquals("BBBB22", live.find(TENANT_A, tripId).orElseThrow().assetId(), "the board shows the backup");
        assertEquals("in_progress", live.find(TENANT_A, tripId).orElseThrow().status());
        assertNull(driving.validTo(), "the driver window stays open through the truck change");

        // 6. the service finishes: transit → unloading → closing completes the trip and kills the hot row
        stages.close(TENANT_A, FEED_A, UUID.fromString(plan.get(1).id()));
        stages.start(TENANT_A, FEED_A, UUID.fromString(plan.get(2).id()));
        stages.close(TENANT_A, FEED_A, UUID.fromString(plan.get(2).id()));
        stages.start(TENANT_A, FEED_A, UUID.fromString(plan.get(3).id()));
        stages.close(TENANT_A, FEED_A, UUID.fromString(plan.get(3).id()));
        assertEquals("completed", trips.get(TENANT_A, tripId).status());
        assertTrue(live.find(TENANT_A, tripId).isEmpty(), "completed kills the hot row");
        assertEquals(Mandate.CLOSED, mandates.close(TENANT_A, FEED_A,
                UUID.fromString(first.mandate().id())).status());
    }

    @Test
    void theIntegrationCanJoinATripAlreadyInTransit() {
        // the integration learns of VDPF81's trip when it is already on the road:
        // its stage plan starts where reality is — transit, then closing
        Mandate m = mandates.createOrGet(TENANT_A, FEED_A,
                new MandateRequest("SRV-1000002", "service", null, null, null, null)).mandate();
        TripView trip = trips.create(TENANT_A, FEED_A, new TripRequest(null, null, null, List.of(m.id()),
                List.of(new StageRequest("transit", null, null, null, null, null),
                        new StageRequest("closing", null, null, null, null, null))));
        UUID tripId = UUID.fromString(trip.id());

        List<Stage> plan = stages.listByTrip(TENANT_A, tripId);
        stages.start(TENANT_A, FEED_A, UUID.fromString(plan.get(0).id()));
        assertEquals("in_progress", trips.get(TENANT_A, tripId).status(),
                "starting at transit is valid: the plan is the integration's");

        // and it can also end wherever the integration says: cancel mid-route with a reason
        assertThrows(IllegalArgumentException.class, () -> trips.cancel(TENANT_A, FEED_A, tripId, " "));
        trips.cancel(TENANT_A, FEED_A, tripId, "cliente anuló el servicio");
        assertEquals("cancelled", trips.get(TENANT_A, tripId).status());
        assertTrue(live.find(TENANT_A, tripId).isEmpty(), "cancelled also kills the hot row");
    }

    @Test
    void tenantBOrderDeliversInPartialsAndIsReceived() {
        // 1. the OC arrives from tenant B's feed
        Mandate oc = mandates.createOrGet(TENANT_B, FEED_B,
                new MandateRequest("OC-78911", "oc", "Camarón congelado export", null, null, null)).mandate();
        UUID mandateId = UUID.fromString(oc.id());

        // 2. the shipper announces how it will deliver: two partials against the single line
        CargoUnit p1 = cargo.announce(TENANT_B, FEED_B, mandateId, new CargoRequest(
                "Camarón congelado 20 pallets", new BigDecimal("20"), "pallet", new BigDecimal("18000"),
                null, "ready"));
        CargoUnit p2 = cargo.announce(TENANT_B, FEED_B, mandateId, new CargoRequest(
                "Camarón congelado saldo", new BigDecimal("8"), "pallet", new BigDecimal("7200"),
                null, null));
        assertEquals(1, p1.partialNo());
        assertEquals(2, p2.partialNo());

        // 3. a trip moves the first partial; mounting it links the OC to the trip
        TripView t1 = trips.create(TENANT_B, FEED_B, new TripRequest(null, null, null, null, List.of(
                new StageRequest("loading", null, null, null, null, null),
                new StageRequest("unloading", null, null, null, null, null),
                new StageRequest("closing", null, null, null, null, null))));
        UUID trip1 = UUID.fromString(t1.id());
        List<Stage> plan = stages.listByTrip(TENANT_B, trip1);
        tripCargo.mount(TENANT_B, FEED_B, trip1, new TripCargoRequest(p1.id(), plan.get(0).id(), plan.get(1).id()));
        assertEquals("OC-78911",
                trips.mandatesOf(TENANT_B, trip1).get(0).externalCode(), "the convergence came from the cargo");
        TripLiveRow boardB = live.find(TENANT_B, trip1).orElseThrow();
        assertEquals("Camarón congelado 20 pallets", boardB.typeLoad());
        assertTrue(boardB.mandateCodes().contains("OC-78911"), boardB.mandateCodes());

        // the OC cannot close while its trip runs, nor unlink while the cargo rides
        assertThrows(IllegalStateException.class, () -> mandates.close(TENANT_B, FEED_B, mandateId));
        assertThrows(IllegalStateException.class,
                () -> trips.unlinkMandate(TENANT_B, FEED_B, trip1, mandateId));

        // 4. the execution moves the cargo: closing loading picks it up, closing unloading delivers it
        stages.start(TENANT_B, FEED_B, UUID.fromString(plan.get(0).id()));
        stages.close(TENANT_B, FEED_B, UUID.fromString(plan.get(0).id()));
        assertEquals(CargoUnit.PICKED, cargo.get(TENANT_B, UUID.fromString(p1.id())).status());
        stages.start(TENANT_B, FEED_B, UUID.fromString(plan.get(1).id()));
        stages.close(TENANT_B, FEED_B, UUID.fromString(plan.get(1).id()));
        assertEquals(CargoUnit.DELIVERED, cargo.get(TENANT_B, UUID.fromString(p1.id())).status());

        // 5. reception with a difference: the detail is mandatory
        UUID p1Id = UUID.fromString(p1.id());
        ReceiveRequest noDetail = new ReceiveRequest("discrepancy", null);
        assertThrows(IllegalArgumentException.class, () -> cargo.receive(TENANT_B, FEED_B, p1Id, noDetail));
        CargoUnit received = cargo.receive(TENANT_B, FEED_B, UUID.fromString(p1.id()),
                new ReceiveRequest("discrepancy", "llegaron 19 de 20 pallets"));
        assertEquals(CargoUnit.RECEIVED, received.status());

        // 6. the trip closes, but the OC stays open: the second partial has not moved
        stages.start(TENANT_B, FEED_B, UUID.fromString(plan.get(2).id()));
        stages.close(TENANT_B, FEED_B, UUID.fromString(plan.get(2).id()));
        assertEquals("completed", trips.get(TENANT_B, trip1).status());
        assertEquals(CargoUnit.ANNOUNCED, cargo.get(TENANT_B, UUID.fromString(p2.id())).status(),
                "the saldo waits for its own trip — the OC is still alive");
        assertEquals(Mandate.CLOSED, mandates.close(TENANT_B, FEED_B, mandateId).status(),
                "v1 closes by trips; closing against pending cargo is the integration's call");
    }

    /**
     * The 12 source-workflow route steps as prod's the source system lists them: type, FEED_A task,
     * FEED_A name, and the service status the stage projects (null inherits).
     */
    private static final String[][] TENANT_A_ROUTE = {
            {"loading", "flow:consolidateLoad", "Consolidación de Carga", "ADDED"},
            {"preparation", "flow:separateDocuments", "Separar Documentos", null},
            {"preparation", "flow:planService", "Planificar Servicio", "SCHEDULED"},
            {"preparation", "flow:assignDriver", "Viaje con Transporte Asignado", null},
            {"preparation", "flow:presentDriver", "Presentación Conductor", null},
            {"preparation", "flow:prepareService", "Validación Condiciones", null},
            {"transit", "flow:missionControl", "Iniciar Viaje", "ONGOING"},
            {"transit", "flow:monitorTrip", "Viaje en Tránsito", null},
            {"stop", "flow:confirmArrival", "Viaje Arribado", "ARRIVED"},
            {"stop", "flow:closeMonitoring", "Confirmar Cierre del Monitoreo", null},
            {"unloading", "flow:confirmDelivery", "Carga Entregada", null},
            {"closing", "flow:receiveDelivery", "Confirmar POD", "FINISHED"}};

    @Test
    void tenantATwelveRouteStepsRunAsStages() {
        ObjectMapper json = new ObjectMapper();
        Fleet fleet = tenantAFleet();

        // resources are VALIDATED, never created, by the service feed
        Truck truck = resources.listTrucks(TENANT_A, "AAAA11", null, 0, 50).stream()
                .filter(x -> x.id().equals(fleet.truck().id())).findFirst().orElseThrow();
        Driver driver = resources.listDrivers(TENANT_A, "22222222-2", null, 0, 50).stream()
                .filter(x -> x.id().equals(fleet.driver().id())).findFirst().orElseThrow();

        // mandate + cargo + the trip with the 12 real steps, each carrying its FEED_A key
        Mandate m = mandates.createOrGet(TENANT_A, FEED_A,
                new MandateRequest("SRV-RUTA-12", "service", null, null, null, null)).mandate();
        CargoUnit unit = cargo.announce(TENANT_A, FEED_A, UUID.fromString(m.id()),
                new CargoRequest("Expedición consolidada", null, null, null, null, "ready"));
        List<StageRequest> plan12 = new java.util.ArrayList<>();
        for (String[] step : TENANT_A_ROUTE) {
            ObjectNode source = json.createObjectNode();
            source.put("taskDefKey", step[1]);
            source.put("nombreEtapa", step[2]);
            plan12.add(new StageRequest(step[0], step[3], null, null, null, source));
        }
        TripView trip = trips.create(TENANT_A, FEED_A, new TripRequest(null, null, null,
                List.of(m.id()), plan12));
        UUID tripId = UUID.fromString(trip.id());
        List<Stage> plan = stages.listByTrip(TENANT_A, tripId);
        assertEquals(12, plan.size());
        assertTrue(plan.get(0).checklist().contains("flow:consolidateLoad")
                && plan.get(11).checklist().contains("Confirmar POD"), "each stage keeps its FEED_A task key");

        // the cargo loads at Consolidación (1) and unloads at Carga Entregada (11)
        tripCargo.mount(TENANT_A, FEED_A, tripId, new TripCargoRequest(unit.id(),
                plan.get(0).id(), plan.get(10).id()));

        // in Viaje con Transporte Asignado (step 4) the resources go on
        assignments.create(TENANT_A, FEED_A, tripId,
                new AssignmentRequest("truck", truck.id(), null, null));
        assignments.create(TENANT_A, FEED_A, tripId,
                new AssignmentRequest("driver", driver.id(), null, null));

        // the 12 steps run in order: one at a time, each with its real open/close times
        for (int i = 0; i < 12; i++) {
            Stage step = plan.get(i);
            stages.start(TENANT_A, FEED_A, UUID.fromString(step.id()));
            if (i == 0) {
                assertEquals("in_progress", trips.get(TENANT_A, tripId).status(),
                        "the FIRST opened step moves the trip, whichever it is");
                assertEquals(Mandate.RUNNING,
                        mandates.get(TENANT_A, UUID.fromString(m.id())).status());
                assertEquals("ADDED", live.find(TENANT_A, tripId).orElseThrow().status(),
                        "Consolidación projects tenant A's own ADDED");
            }
            if (i == 2) {
                assertEquals("SCHEDULED", live.find(TENANT_A, tripId).orElseThrow().status());
            }
            if (i == 6) {
                assertEquals("ONGOING", live.find(TENANT_A, tripId).orElseThrow().status(),
                        "the board speaks tenant A's vocabulary, not the lifecycle's");
            }
            if (i == 3) {
                assertEquals("SCHEDULED", live.find(TENANT_A, tripId).orElseThrow().status(),
                        "a stage without service_status inherits the last one");
            }
            stages.close(TENANT_A, FEED_A, UUID.fromString(step.id()));
            if (i == 0) {
                assertEquals(CargoUnit.PICKED, cargo.get(TENANT_A, UUID.fromString(unit.id())).status(),
                        "closing Consolidación picks the cargo up");
            }
            if (i == 10) {
                assertEquals(CargoUnit.DELIVERED, cargo.get(TENANT_A, UUID.fromString(unit.id())).status(),
                        "closing Carga Entregada delivers it");
            }
        }

        // Confirmar POD (closing) completed the trip; the hot row died; the mandate closes
        assertEquals("completed", trips.get(TENANT_A, tripId).status());
        assertTrue(live.find(TENANT_A, tripId).isEmpty());
        assertEquals(Mandate.CLOSED,
                mandates.close(TENANT_A, FEED_A, UUID.fromString(m.id())).status());
        // every step kept its own real window
        for (Stage s : stages.listByTrip(TENANT_A, tripId)) {
            assertTrue(s.actualStart() != null && s.actualEnd() != null,
                    s.stageType() + " #" + s.seq() + " keeps its times");
        }
    }

    @Test
    void tenantBRunsOnThreeStatesPlusCancelled() {
        // tenant B's whole world: programado → en ruta → cerrado (and anulado)
        Mandate oc = mandates.createOrGet(TENANT_B, FEED_B,
                new MandateRequest("OC-3ESTADOS", "oc", null, null, null, null)).mandate();

        // PROGRAMADO = the trip exists, nothing started: its plan is just transito + cierre
        TripView t = trips.create(TENANT_B, FEED_B, new TripRequest(null, null, null, List.of(oc.id()),
                List.of(new StageRequest("transit", "en ruta", null, null, null, null),
                        new StageRequest("closing", "closed", null, null, null, null))));
        UUID tripId = UUID.fromString(t.id());
        assertEquals("planned", trips.get(TENANT_B, tripId).status());
        assertEquals("planned", live.find(TENANT_B, tripId).orElseThrow().status(),
                "programado = the lifecycle fallback while no stage projects");

        // EN RUTA = the single transito stage opens and projects tenant B's own words
        List<Stage> plan = stages.listByTrip(TENANT_B, tripId);
        stages.start(TENANT_B, FEED_B, UUID.fromString(plan.get(0).id()));
        assertEquals("in_progress", trips.get(TENANT_B, tripId).status());
        assertEquals("en ruta", live.find(TENANT_B, tripId).orElseThrow().status());

        // CERRADO = transito closes and cierre opens+closes
        stages.close(TENANT_B, FEED_B, UUID.fromString(plan.get(0).id()));
        stages.start(TENANT_B, FEED_B, UUID.fromString(plan.get(1).id()));
        stages.close(TENANT_B, FEED_B, UUID.fromString(plan.get(1).id()));
        assertEquals("completed", trips.get(TENANT_B, tripId).status());
        assertTrue(live.find(TENANT_B, tripId).isEmpty());

        // ANULADO: a second trip of the same OC dies mid-route with its reason
        TripView t2 = trips.create(TENANT_B, FEED_B, new TripRequest(null, null, null, List.of(oc.id()),
                List.of(new StageRequest("transit", null, null, null, null, null),
                        new StageRequest("closing", null, null, null, null, null))));
        UUID trip2 = UUID.fromString(t2.id());
        stages.start(TENANT_B, FEED_B, UUID.fromString(stages.listByTrip(TENANT_B, trip2).get(0).id()));
        trips.cancel(TENANT_B, FEED_B, trip2, "cliente anuló");
        assertEquals("cancelled", trips.get(TENANT_B, trip2).status());
        assertTrue(live.find(TENANT_B, trip2).isEmpty());

        // with one trip realizado and one anulado, the OC closes
        assertEquals(Mandate.CLOSED,
                mandates.close(TENANT_B, FEED_B, UUID.fromString(oc.id())).status());
    }

    @Test
    void tenantsNeverSeeEachOther() {
        mandates.createOrGet(TENANT_A, FEED_A, new MandateRequest("SRV-X-1", "service", null, null, null, null));
        mandates.createOrGet(TENANT_B, FEED_B, new MandateRequest("SRV-X-1", "oc", null, null, null, null));
        assertEquals(1, mandates.list(TENANT_A, null, "SRV-X-1", null, null).size());
        assertEquals("service", mandates.list(TENANT_A, null, "SRV-X-1", null, null).get(0).orderType());
        assertEquals("oc", mandates.list(TENANT_B, null, "SRV-X-1", null, null).get(0).orderType());
        List<TripLiveRow> tenantABoard = live.list(TENANT_A);
        for (TripLiveRow row : tenantABoard) {
            assertEquals(TENANT_A, row.tenantCode());
        }
    }
}

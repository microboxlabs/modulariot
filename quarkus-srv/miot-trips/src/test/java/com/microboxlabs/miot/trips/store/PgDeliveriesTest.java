package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.content.ContentService;
import com.microboxlabs.miot.core.content.FileContentDriver;
import com.microboxlabs.miot.core.content.PgContentStore;
import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.fleet.resources.service.FleetResourcesService;
import com.microboxlabs.miot.trips.domain.Delivery;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.dto.BoardView;
import com.microboxlabs.miot.trips.dto.DeliveryViews;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.dto.MonitorRequest;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.dto.TripSheet;
import com.microboxlabs.miot.trips.dto.TripView;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.BoardService;
import com.microboxlabs.miot.trips.service.DeliveryService;
import com.microboxlabs.miot.trips.service.MandateService;
import com.microboxlabs.miot.trips.service.MilestoneService;
import com.microboxlabs.miot.trips.service.MonitorEngine;
import com.microboxlabs.miot.trips.service.MonitorService;
import com.microboxlabs.miot.trips.service.StageService;
import com.microboxlabs.miot.trips.service.TripBoard;
import com.microboxlabs.miot.trips.service.TripLiveProjector;
import com.microboxlabs.miot.trips.service.TripService;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Deliveries on real trips: a POD file in the content store, the steps of the monitor's cycle, the delivery lanes,
 * and the trip completed once the closure is confirmed and every load reached the completing step. Skipped unless
 * {@code -Dmiot.trips.test.pg-url=…} is set.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgDeliveriesTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String ACTOR = "ops@example.com";
    private static final byte[] PDF = "%PDF-1.7 manifest signed".getBytes(StandardCharsets.UTF_8);

    private static Vertx vertx;
    private static Pool pool;
    private static Path files;

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
    private final PgMonitorStore monitorStore = new PgMonitorStore(() -> pool);
    private final PgMonitorRunStore runs = new PgMonitorRunStore(() -> pool);
    private final MonitorService monitors = new MonitorService(monitorStore, audit, tx);
    private final FleetResourcesService fleet = new FleetResourcesService(
            new com.microboxlabs.miot.fleet.resources.store.PgResourceStore(() -> pool));
    private final MilestoneService milestones = new MilestoneService(new PgMilestoneStore(() -> pool),
            new PgTripStore(() -> pool), audit, tx);
    private final ContentService contents = new ContentService(new PgContentStore(() -> pool),
            List.of(new FileContentDriver(files)), "fs", 1024 * 1024, ContentService.DEFAULT_TYPES,
            Duration.ofHours(24), Clock.systemUTC());
    private final DeliveryService deliveries = new DeliveryService(new PgDeliveryStore(() -> pool),
            new PgTripStore(() -> pool), runs, monitorStore, contents, audit, tx);
    private final MonitorEngine engine = new MonitorEngine(runs, monitorStore, new PgTripStore(() -> pool),
            new PgStageStore(() -> pool), new PgAssignmentStore(() -> pool), new PgLocationStore(() -> pool), stages,
            trips, mandates, milestones, fleet, audit, com.microboxlabs.miot.trips.events.TripEvents.NONE, tx,
            Clock.systemUTC(), deliveries);
    private final BoardService board = new BoardService(new PgBoardStore(() -> pool), fleet,
            new PgStageStore(() -> pool), milestones, runs, new PgConfirmerStore(() -> pool), deliveries,
            Clock.systemUTC());

    private String tenant;

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(
                PgTripsStoresTest.URL_PROPERTY))).using(vertx).build();
        PgTripsStoresTest.recreateSchemas(pool);
        files = Files.createTempDirectory("miot-content-test");
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
        monitors.saveDraft(tenant, ACTOR, "pod", new MonitorRequest("POD", null, List.of(),
                Map.of("deliverySteps", "delivered,settled", "deliveryCompletesTrip", "settled"),
                List.of(new MonitorRequest.Rule("open", null, "plan", null, "event.kind == 'created'",
                        List.of(new TripMonitor.Action("start", "preparation")), 10, true))));
        monitors.publish(tenant, ACTOR, "pod");
    }

    private TripView newTrip(int loads) {
        List<String> ids = new java.util.ArrayList<>();
        for (int i = 0; i < loads; i++) {
            Mandate m = mandates.createOrGet(tenant, ACTOR, new MandateRequest("S-" + UUID.randomUUID()
                    .toString().substring(0, 6), "direct", null, null, null, null)).mandate();
            ids.add(m.id());
        }
        List<StageRequest> plan = List.of("preparation", "transit", "closing").stream()
                .map(t -> new StageRequest(t, null, null, null, null, null)).toList();
        return trips.create(tenant, ACTOR, new TripRequest(null, null, OffsetDateTime.now(ZoneOffset.UTC), ids,
                plan, "pod"));
    }

    private String lane(UUID tripId) {
        return board.view(tenant, TripBoard.DELIVERY, null, null, null, null).lanes().stream()
                .filter(l -> l.cards().stream().anyMatch(c -> c.tripId().equals(tripId.toString())))
                .map(BoardView.Lane::key).findFirst().orElse(null);
    }

    private DeliveryViews.Delivery confirm(UUID tripId, String deliveryId, String step) {
        return deliveries.confirm(tenant, ACTOR, tripId, UUID.fromString(deliveryId), step, null, "ui", null,
                null);
    }

    @Test
    void aDeliveryKeepsItsLoadsAndReferenceAndRequiresProofAndOrderedSteps() {
        TripView t = newTrip(2);
        UUID tripId = UUID.fromString(t.id());
        String codeA = t.mandates().get(0).externalCode();
        assertEquals(null, lane(tripId), "no delivery while the monitoring runs");

        DeliveryViews.Delivery a = deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery("R-1", "Customer A", List.of(codeA), Map.of("dock", "3"), null,
                        null));
        assertEquals(List.of(codeA), a.mandates().stream().map(DeliveryViews.Mandate::code).toList());
        assertEquals(List.of("delivered", "settled"), a.steps().stream().map(Delivery.Step::step).toList());
        assertEquals(a.id(), deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery("R-1", null, null, null, null, null)).id(), "same reference");
        assertEquals(TripBoard.TO_DELIVER, lane(tripId), "a trip with a delivery is in the delivery view");
        assertEquals(1, board.counts(tenant).get(TripBoard.DELIVERY));

        String deliveryId = a.id();
        assertThrows(IllegalStateException.class, () -> confirm(tripId, deliveryId, "delivered"), "no proof yet");
        assertThrows(IllegalStateException.class, () -> confirm(tripId, deliveryId, "settled"), "not delivered");
        assertThrows(IllegalArgumentException.class, () -> confirm(tripId, deliveryId, "accepted"), "not in cycle");
    }

    @Test
    void aPodAndTheCycleStepsCompleteTheTripOnceEveryLoadIsSettled() throws IOException {
        TripView t = newTrip(2);
        UUID tripId = UUID.fromString(t.id());
        String codeA = t.mandates().get(0).externalCode();

        DeliveryViews.Delivery a = deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery("R-1", "Customer A", List.of(codeA), Map.of("dock", "3"), null,
                        null));
        DeliveryViews.Delivery withPod = deliveries.upload(tenant, ACTOR, tripId, UUID.fromString(a.id()),
                "signature", "manifest.pdf", "application/pdf", new ByteArrayInputStream(PDF), Map.of(), "app");
        assertEquals("pending", withPod.steps().get(0).status(), "a POD asks for the delivery");
        assertEquals(TripBoard.DELIVERY_PENDING, lane(tripId));
        assertEquals(1, board.counts(tenant).get(TripBoard.DELIVERY));
        String proofId = withPod.proofs().get(0).id();
        try (InputStream in = deliveries.proofContent(tenant, tripId, UUID.fromString(proofId)).stream()) {
            assertArrayEquals(PDF, in.readAllBytes());
        }
        assertEquals("trips:delivery_proof:" + proofId, contents.find(tenant,
                UUID.fromString(withPod.proofs().get(0).contentId())).orElseThrow().owner());
        UUID aId = UUID.fromString(a.id());
        ByteArrayInputStream invalidType = new ByteArrayInputStream(PDF);
        assertThrows(IllegalArgumentException.class, () -> deliveries.upload(tenant, ACTOR, tripId,
                aId, "photo", "x.html", "text/html", invalidType, null, null));

        confirm(tripId, a.id(), "delivered");
        DeliveryViews.Delivery b = deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery(null, "Customer B", null, null, null, null));
        assertEquals(List.of(t.mandates().get(1).externalCode()),
                b.mandates().stream().map(DeliveryViews.Mandate::code).toList(), "the loads left");
        assertThrows(IllegalStateException.class, () -> deliveries.create(tenant, ACTOR, tripId, null));
        UUID bId = UUID.fromString(b.id());
        DeliveryService.NewProof invalidProof = new DeliveryService.NewProof("photo", null, "file:///etc/passwd",
                null, null, null);
        assertThrows(IllegalArgumentException.class, () -> deliveries.addProof(tenant, ACTOR, tripId,
                bId, invalidProof));
        deliveries.addProof(tenant, ACTOR, tripId, UUID.fromString(b.id()),
                new DeliveryService.NewProof("photo", null, "https://example.com/pod/b.jpg", null, null, null));
        confirm(tripId, b.id(), "delivered");
        assertEquals("delivered", lane(tripId));
        assertEquals(1, board.counts(tenant).get(TripBoard.DELIVERY));
        BoardView.Card card = board.view(tenant, TripBoard.DELIVERY, null, null, null, null).lanes().stream()
                .flatMap(l -> l.cards().stream()).findFirst().orElseThrow();
        assertEquals(2, card.delivery().loads());
        assertEquals(2, card.delivery().reached().get("delivered"));

        confirm(tripId, a.id(), "settled");
        milestones.confirm(tenant, ACTOR, tripId, "closure", null, "ui", null);
        assertEquals(Trip.IN_PROGRESS, trips.get(tenant, tripId).status(), "one load is not settled");

        confirm(tripId, b.id(), "settled");
        assertEquals(Trip.DONE, trips.get(tenant, tripId).status());
        assertTrue(engine.transitions(tenant, tripId, 50).stream().anyMatch(x -> "delivery".equals(x.ruleKey())));
        assertEquals(null, lane(tripId), "a finished trip leaves the delivery view");
        assertEquals(0, board.counts(tenant).get(TripBoard.DELIVERY));

        TripSheet sheet = board.sheet(tenant, tripId);
        assertNotNull(sheet.deliveries());
        assertEquals(2, sheet.deliveries().deliveries().size());
        assertEquals(List.of(), sheet.deliveries().uncovered());
    }

    @Test
    void aRejectedRequestAsksAgainOnTheNextProof() {
        TripView t = newTrip(1);
        UUID tripId = UUID.fromString(t.id());
        DeliveryViews.Delivery d = deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery(null, null, null, null, null, null));
        UUID id = UUID.fromString(d.id());
        deliveries.addProof(tenant, ACTOR, tripId, id,
                new DeliveryService.NewProof("photo", null, "https://example.com/a.jpg", null, null, "whatsapp"));

        DeliveryViews.Delivery rejected = deliveries.reject(tenant, ACTOR, tripId, id, "delivered", "ui", "blurry");
        assertEquals("rejected", rejected.steps().get(0).status());
        assertThrows(IllegalStateException.class,
                () -> deliveries.reject(tenant, ACTOR, tripId, id, "delivered", "ui", null));

        DeliveryViews.Delivery again = deliveries.addProof(tenant, ACTOR, tripId, id,
                new DeliveryService.NewProof("photo", null, "https://example.com/b.jpg", null, null, "whatsapp"));
        assertEquals("pending", again.steps().get(0).status());
        assertEquals("whatsapp", again.steps().get(0).source());
    }
    @Test
    void removingTheLastOutstandingLoadReevaluatesCompletion() {
        TripView t = newTrip(2);
        UUID tripId = UUID.fromString(t.id());
        DeliveryViews.Delivery d = deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery(null, null, List.of(t.mandates().get(0).mandateId()),
                        null, null, null));
        deliveries.addProof(tenant, ACTOR, tripId, UUID.fromString(d.id()),
                new DeliveryService.NewProof("photo", null, "https://example.com/pod.jpg", null, null, null));
        confirm(tripId, d.id(), "delivered");
        confirm(tripId, d.id(), "settled");
        milestones.confirm(tenant, ACTOR, tripId, "closure", null, "ui", null);
        assertEquals(Trip.IN_PROGRESS, trips.get(tenant, tripId).status());

        trips.unlinkMandate(tenant, ACTOR, tripId, UUID.fromString(t.mandates().get(1).mandateId()));

        assertEquals(Trip.DONE, trips.get(tenant, tripId).status());
    }

    @Test
    void failedCompletionDoesNotEvaluateStageEventsFromItsRolledBackAction() {
        monitors.saveDraft(tenant, ACTOR, "broken-pod", new MonitorRequest("Incomplete plan", null, List.of(),
                Map.of("deliverySteps", "delivered", "deliveryCompletesTrip", "delivered",
                        "deliveryProofRequired", false),
                List.of(new MonitorRequest.Rule("open", null, "plan", null, "event.kind == 'created'",
                                List.of(new TripMonitor.Action("start", "preparation")), 10, true),
                        new MonitorRequest.Rule("ghost-closure", null, "stage", null, "event.kind == 'closed'",
                                List.of(new TripMonitor.Action("alert", "ghost")), 10, true))));
        monitors.publish(tenant, ACTOR, "broken-pod");
        TripView t = trips.create(tenant, ACTOR, new TripRequest(null, null, null, List.of(),
                List.of(new StageRequest("preparation", null, null, null, null, null)), "broken-pod"));
        UUID tripId = UUID.fromString(t.id());
        DeliveryViews.Delivery d = deliveries.create(tenant, ACTOR, tripId, null);
        confirm(tripId, d.id(), "delivered");

        milestones.confirm(tenant, ACTOR, tripId, "closure", null, "ui", null);

        assertEquals(Trip.IN_PROGRESS, trips.get(tenant, tripId).status());
        assertEquals(Stage.RUNNING, stages.listByTrip(tenant, tripId).get(0).status());
        var transitions = engine.transitions(tenant, tripId, 50);
        assertTrue(transitions.stream().anyMatch(x -> "delivery".equals(x.ruleKey())
                && x.error() != null && x.error().contains("no closing stage")));
        assertFalse(transitions.stream().anyMatch(x -> x.matched().contains("ghost-closure")));
    }

    @Test
    void oneSnapshotReadsTheDeliveryDataOnceForEveryStepFlag() {
        TripView t = newTrip(1);
        UUID tripId = UUID.fromString(t.id());
        DeliveryViews.Delivery d = deliveries.create(tenant, ACTOR, tripId, null);
        deliveries.addProof(tenant, ACTOR, tripId, UUID.fromString(d.id()),
                new DeliveryService.NewProof("photo", null, "https://example.com/pod.jpg", null, null, null));
        confirm(tripId, d.id(), "delivered");
        AtomicInteger reads = new AtomicInteger();
        PgDeliveryStore countedDeliveries = new PgDeliveryStore(() -> pool) {
            @Override
            public List<Delivery> list(String tenantCode, UUID id) {
                reads.incrementAndGet();
                return super.list(tenantCode, id);
            }

            @Override
            public List<Delivery.Step> steps(String tenantCode, UUID id) {
                reads.incrementAndGet();
                return super.steps(tenantCode, id);
            }
        };
        PgTripStore countedTrips = new PgTripStore(() -> pool) {
            @Override
            public List<MandateRef> mandatesOf(String tenantCode, UUID id) {
                reads.incrementAndGet();
                return super.mandatesOf(tenantCode, id);
            }
        };
        DeliveryService counted = new DeliveryService(countedDeliveries, countedTrips, runs, monitorStore,
                contents, audit, tx);
        assertEquals(Map.of("delivered", true, "accepted", false, "settled", false),
                counted.snapshot(tenant, tripId));
        assertEquals(3, reads.get());
    }

    @Test
    void repeatedConfirmationValidatesTheAccumulatedEvidence() {
        TripView t = newTrip(1);
        UUID tripId = UUID.fromString(t.id());
        DeliveryViews.Delivery d = deliveries.create(tenant, ACTOR, tripId, null);
        UUID id = UUID.fromString(d.id());
        deliveries.addProof(tenant, ACTOR, tripId, id,
                new DeliveryService.NewProof("photo", null, "https://example.com/pod.jpg", null, null, null));
        Map<String, Object> evidence = new java.util.LinkedHashMap<>();
        for (int i = 0; i < 50; i++) {
            evidence.put("key" + i, "a");
        }
        deliveries.confirm(tenant, ACTOR, tripId, id, "delivered", null, "ui", null, evidence);
        Map<String, Object> extra = Map.of("oneMore", "a");
        assertThrows(IllegalArgumentException.class,
                () -> deliveries.confirm(tenant, ACTOR, tripId, id, "delivered", null, "ui", null, extra));
        deliveries.confirm(tenant, ACTOR, tripId, id, "delivered", null, "ui", null,
                Map.of("key0", "a".repeat(9000)));
        Map<String, Object> tooLarge = Map.of("key1", "b".repeat(9000));
        assertThrows(IllegalArgumentException.class,
                () -> deliveries.confirm(tenant, ACTOR, tripId, id, "delivered", null, "ui", null, tooLarge));
        Delivery.Step stored = new PgDeliveryStore(() -> pool).step(tenant, id, "delivered").orElseThrow();
        assertEquals(50, stored.evidence().size());
        assertEquals("a", stored.evidence().get("key1"));
        assertTrue(stored.isConfirmed());
    }

}

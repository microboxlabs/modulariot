package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.content.ContentService;
import com.microboxlabs.miot.core.content.FileContentDriver;
import com.microboxlabs.miot.core.content.PgContentStore;
import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.fleet.resources.service.FleetResourcesService;
import com.microboxlabs.miot.trips.domain.Mandate;
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
    void aPodAndTheCycleStepsCompleteTheTripOnceEveryLoadIsSettled() throws IOException {
        TripView t = newTrip(2);
        UUID tripId = UUID.fromString(t.id());
        String codeA = t.mandates().get(0).externalCode();
        assertEquals(null, lane(tripId), "no delivery while the monitoring runs");

        DeliveryViews.Delivery a = deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery("R-1", "Customer A", List.of(codeA), Map.of("dock", "3"), null,
                        null));
        assertEquals(List.of(codeA), a.mandates().stream().map(DeliveryViews.Mandate::code).toList());
        assertEquals(List.of("delivered", "settled"), a.steps().stream().map(s -> s.step()).toList());
        assertEquals(a.id(), deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery("R-1", null, null, null, null, null)).id(), "same reference");
        assertEquals(TripBoard.TO_DELIVER, lane(tripId), "a trip with a delivery is in the delivery view");

        assertThrows(IllegalStateException.class, () -> confirm(tripId, a.id(), "delivered"), "no proof yet");
        assertThrows(IllegalStateException.class, () -> confirm(tripId, a.id(), "settled"), "not delivered");
        assertThrows(IllegalArgumentException.class, () -> confirm(tripId, a.id(), "accepted"), "not in cycle");

        DeliveryViews.Delivery withPod = deliveries.upload(tenant, ACTOR, tripId, UUID.fromString(a.id()),
                "signature", "manifest.pdf", "application/pdf", new ByteArrayInputStream(PDF), Map.of(), "app");
        assertEquals("pending", withPod.steps().get(0).status(), "a POD asks for the delivery");
        assertEquals(TripBoard.DELIVERY_PENDING, lane(tripId));
        String proofId = withPod.proofs().get(0).id();
        try (InputStream in = deliveries.proofContent(tenant, tripId, UUID.fromString(proofId)).stream()) {
            assertArrayEquals(PDF, in.readAllBytes());
        }
        assertEquals("trips:delivery_proof:" + proofId, contents.find(tenant,
                UUID.fromString(withPod.proofs().get(0).contentId())).orElseThrow().owner());
        assertThrows(IllegalArgumentException.class, () -> deliveries.upload(tenant, ACTOR, tripId,
                UUID.fromString(a.id()), "photo", "x.html", "text/html", new ByteArrayInputStream(PDF), null, null));

        confirm(tripId, a.id(), "delivered");
        DeliveryViews.Delivery b = deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery(null, "Customer B", null, null, null, null));
        assertEquals(List.of(t.mandates().get(1).externalCode()),
                b.mandates().stream().map(DeliveryViews.Mandate::code).toList(), "the loads left");
        assertThrows(IllegalStateException.class, () -> deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery(null, null, null, null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> deliveries.addProof(tenant, ACTOR, tripId,
                UUID.fromString(b.id()), new DeliveryService.NewProof("photo", null, "file:///etc/passwd", null,
                        null, null)));
        deliveries.addProof(tenant, ACTOR, tripId, UUID.fromString(b.id()),
                new DeliveryService.NewProof("photo", null, "https://example.com/pod/b.jpg", null, null, null));
        confirm(tripId, b.id(), "delivered");
        assertEquals("delivered", lane(tripId));
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
}

package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.content.ContentService;
import com.microboxlabs.miot.core.content.FileContentDriver;
import com.microboxlabs.miot.core.content.PgContentStore;
import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.selectable.Selectable;
import com.microboxlabs.miot.core.selectable.SelectableDefaultsFile;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.TripDocument;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.dto.DeliveryViews;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.dto.MonitorRequest;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.dto.TripView;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.DeliveryService;
import com.microboxlabs.miot.trips.service.MandateService;
import com.microboxlabs.miot.trips.service.MonitorService;
import com.microboxlabs.miot.trips.service.TripDocumentLists;
import com.microboxlabs.miot.trips.service.TripDocumentService;
import com.microboxlabs.miot.trips.service.TripDocumentService.ReviewDecision;
import com.microboxlabs.miot.trips.service.TripLiveProjector;
import com.microboxlabs.miot.trips.service.TripService;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * A trip's documents on real tables: types from the seeded lists, review rounds per version, replacing a file, a
 * document that proves a delivery, and deleting. Skipped unless {@code -Dmiot.trips.test.pg-url=…} is set.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgTripDocumentsTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String ACTOR = "ops@example.com";
    private static final byte[] PDF = "%PDF-1.7 manifest".getBytes(StandardCharsets.UTF_8);
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I',
            'F', 0};
    private static final List<Selectable> LISTS = SelectableDefaultsFile.read(TripDocumentLists.class,
            "/selectables/defaults/trip-documents.json");

    private static Vertx vertx;
    private static Pool pool;
    private static Path files;

    private final Transactions tx = new PgTransactions(() -> pool);
    private final AuditService audit = new AuditService(new PgAuditStore(() -> pool), () -> com.microboxlabs.miot.trips.service.TripChanges.NONE);
    private final MandateService mandates = new MandateService(new PgMandateStore(() -> pool), audit, tx);
    private final TripLiveProjector projector = PgTripsStoresTest.projector(() -> pool);
    private final TripService trips = new TripService(new PgTripStore(() -> pool), new PgStageStore(() -> pool),
            new PgAssignmentStore(() -> pool), new PgTripCargoStore(() -> pool), new PgCargoStore(() -> pool),
            mandates, projector, audit, tx);
    private final PgMonitorStore monitorStore = new PgMonitorStore(() -> pool);
    private final MonitorService monitors = new MonitorService(monitorStore, audit, tx);
    private final ContentService contents = new ContentService(new PgContentStore(() -> pool),
            List.of(new FileContentDriver(files)), "fs", 1024 * 1024, ContentService.DEFAULT_TYPES,
            Duration.ofHours(24), Clock.systemUTC());
    private final DeliveryService deliveries = new DeliveryService(new PgDeliveryStore(() -> pool),
            new PgTripStore(() -> pool), new PgMonitorRunStore(() -> pool), monitorStore, contents, audit, tx);
    private final TripDocumentService documents = new TripDocumentService(new PgTripDocumentStore(() -> pool),
            new PgTripStore(() -> pool), contents, new TripDocumentLists((tenant, key) -> LISTS.stream()
                    .filter(l -> l.key().equals(key)).findFirst().orElseThrow().options()),
            deliveries, audit, tx);

    private String tenant;

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(
                PgTripsStoresTest.URL_PROPERTY))).using(vertx).build();
        PgTripsStoresTest.recreateSchemas(pool);
        files = Files.createTempDirectory("miot-documents-test");
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @BeforeEach
    void tenantWithAMonitor() {
        tenant = "t-" + UUID.randomUUID().toString().substring(0, 8);
        monitors.saveDraft(tenant, ACTOR, "pod", new MonitorRequest("POD", null, List.of(),
                Map.of("deliverySteps", "delivered"), List.of()));
        monitors.publish(tenant, ACTOR, "pod");
    }

    private UUID newTrip() {
        Mandate m = mandates.createOrGet(tenant, ACTOR, new MandateRequest("S-" + UUID.randomUUID().toString()
                .substring(0, 6), "direct", null, null, null, null)).mandate();
        TripView t = trips.create(tenant, ACTOR, new TripRequest(null, null, OffsetDateTime.now(ZoneOffset.UTC),
                List.of(m.id()), List.of(new StageRequest("transit", null, null, null, null, null)), "pod"));
        return UUID.fromString(t.id());
    }

    private TripDocument upload(UUID tripId, String type, UUID deliveryId, String name, String mime, byte[] bytes) {
        return documents.upload(tenant, ACTOR, tripId, type, deliveryId, name, mime, new ByteArrayInputStream(bytes));
    }

    private String owner(String contentId) {
        return pool.preparedQuery("SELECT owner FROM miot_core.content WHERE id = $1")
                .execute(Tuple.of(UUID.fromString(contentId))).await().atMost(WAIT).iterator().next()
                .getString("owner");
    }

    private static ReviewDecision decision(TripDocument d, String verdict, List<String> reasons) {
        return new ReviewDecision(d.updatedAt(), verdict, reasons, null);
    }

    @Test
    void aTypeThatNeedsReviewIsDecidedPerVersionAndReplacingSendsItBack() throws IOException {
        UUID tripId = newTrip();
        TripDocument manifest = upload(tripId, "CARGO_MANIFEST", null, "manifest.pdf", "application/pdf", PDF);
        assertNull(manifest.reviewStatus(), "a cargo manifest needs no review");
        assertEquals("application/pdf", manifest.mimetype());
        UUID manifestId = UUID.fromString(manifest.id());
        ReviewDecision manifestDecision = decision(manifest, "APPROVED", List.of());
        assertThrows(IllegalStateException.class,
                () -> documents.review(tenant, ACTOR, tripId, manifestId, manifestDecision));

        TripDocument photo = upload(tripId, "PICKUP_FRONT_IMAGE", null, "front.jpg", "image/jpeg", JPEG);
        UUID photoId = UUID.fromString(photo.id());
        assertEquals(TripDocument.PENDING, photo.reviewStatus());
        documents.review(tenant, ACTOR, tripId, photoId, decision(photo, "rejected", List.of("illegible_text")));

        TripDocument replaced = documents.replace(tenant, ACTOR, tripId, photoId, "front-2.jpg", "image/jpeg",
                new ByteArrayInputStream(JPEG));
        assertEquals(2, replaced.version());
        assertEquals(TripDocument.PENDING, replaced.reviewStatus(), "a new file goes back to review");
        assertEquals("trips:document:" + photo.id() + ":v1", owner(photo.contentId()), "the old version stays");

        documents.review(tenant, ACTOR, tripId, photoId, decision(replaced, "APPROVED", List.of()));
        List<TripDocument.Review> rounds = documents.reviews(tenant, tripId, photoId);
        assertEquals(List.of("REJECTED", "APPROVED"), rounds.stream().map(TripDocument.Review::verdict).toList());
        assertEquals(List.of(1, 2), rounds.stream().map(TripDocument.Review::version).toList());
        assertEquals(List.of("illegible_text"), rounds.get(0).reasons());
        assertEquals(TripDocument.APPROVED, documents.list(tenant, tripId).get(1).reviewStatus());

        TripDocument other = documents.change(tenant, ACTOR, tripId, photoId, "OTHER", "front.jpg");
        assertNull(other.reviewStatus(), "a type without review drops the status");
        assertEquals(TripDocument.PENDING,
                documents.change(tenant, ACTOR, tripId, photoId, "PROOF_OF_PICKUP", null).reviewStatus());
        assertThrows(IllegalArgumentException.class,
                () -> documents.change(tenant, ACTOR, tripId, photoId, "UNKNOWN", null));

        try (InputStream in = documents.content(tenant, tripId, photoId).stream()) {
            assertArrayEquals(JPEG, in.readAllBytes());
        }
        documents.delete(tenant, ACTOR, tripId, UUID.fromString(manifest.id()));
        assertEquals(1, documents.list(tenant, tripId).size());
        assertNull(owner(manifest.contentId()), "the file goes to the cleanup");
    }

    @Test
    void reviewingAnOldSnapshotCannotDecideAReplacementOrReclassifiedDocument() {
        UUID tripId = newTrip();
        TripDocument photo = upload(tripId, "PICKUP_FRONT_IMAGE", null, "front.jpg", "image/jpeg", JPEG);
        UUID id = UUID.fromString(photo.id());
        ReviewDecision stale = decision(photo, "APPROVED", List.of());
        TripDocument replaced = documents.replace(tenant, ACTOR, tripId, id, "new.jpg", "image/jpeg",
                new ByteArrayInputStream(JPEG));
        assertThrows(IllegalStateException.class, () -> documents.review(tenant, ACTOR, tripId, id, stale));
        assertTrue(documents.reviews(tenant, tripId, id).isEmpty());
        documents.review(tenant, ACTOR, tripId, id, decision(replaced, "APPROVED", List.of()));
        TripDocument approved = documents.document(tenant, tripId, id);
        ReviewDecision beforeReclassification = decision(approved, "APPROVED", List.of());
        TripDocument changed = documents.change(tenant, ACTOR, tripId, id, "PROOF_OF_PICKUP", null);
        assertEquals(TripDocument.PENDING, changed.reviewStatus());
        assertNull(changed.reviewedAt());
        assertNull(changed.reviewedBy());
        assertThrows(IllegalStateException.class,
                () -> documents.review(tenant, ACTOR, tripId, id, beforeReclassification));
        assertEquals(1, documents.reviews(tenant, tripId, id).size());
    }

    @Test
    void reviewRejectsUnknownDisabledAndWrongTypeReasons() {
        UUID tripId = newTrip();
        TripDocument photo = upload(tripId, "PICKUP_FRONT_IMAGE", null, "front.jpg", "image/jpeg", JPEG);
        UUID id = UUID.fromString(photo.id());
        TripDocumentLists customLists = new TripDocumentLists((t, key) -> {
            if (TripDocumentLists.REASONS.equals(key)) {
                return List.of(
                        com.microboxlabs.miot.core.selectable.SelectableOption.of("disabled", "Disabled", "Disabled").asDisabled(),
                        com.microboxlabs.miot.core.selectable.SelectableOption.of("pickup", "Pickup", "Pickup").withParent("PROOF_OF_PICKUP"));
            }
            return LISTS.stream().filter(l -> l.key().equals(key)).findFirst().orElseThrow().options();
        });
        TripDocumentService service = new TripDocumentService(new PgTripDocumentStore(() -> pool),
                new PgTripStore(() -> pool), contents, customLists, deliveries, audit, tx);
        for (String reason : List.of("unknown", "disabled", "pickup")) {
            ReviewDecision invalid = decision(photo, "REJECTED", List.of(reason));
            assertThrows(IllegalArgumentException.class,
                    () -> service.review(tenant, ACTOR, tripId, id, invalid));
        }
        assertTrue(documents.reviews(tenant, tripId, id).isEmpty());
        assertEquals(TripDocument.PENDING, documents.document(tenant, tripId, id).reviewStatus());
    }

    @Test
    void deletingAProofWaitsForConcurrentDeliveryConfirmation() throws Exception {
        UUID tripId = newTrip();
        DeliveryViews.Delivery delivery = deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery("R-1", "Recipient", null, null, null, null));
        UUID deliveryId = UUID.fromString(delivery.id());
        TripDocument pod = upload(tripId, "PROOF_OF_DELIVERY", deliveryId, "pod.pdf", "application/pdf", PDF);
        UUID documentId = UUID.fromString(pod.id());
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch deleting = new CountDownLatch(1);
        try (var workers = Executors.newFixedThreadPool(2)) {
            var confirm = workers.submit(() -> tx.inTransaction(() -> {
                new PgTripStore(() -> pool).find(tenant, tripId).orElseThrow();
                locked.countDown();
                await(release);
                return deliveries.confirm(tenant, ACTOR, tripId, deliveryId, "delivered", null, "ui", null, null);
            }));
            assertTrue(locked.await(10, TimeUnit.SECONDS));
            var delete = workers.submit(() -> {
                deleting.countDown();
                documents.delete(tenant, ACTOR, tripId, documentId);
            });
            try {
                assertTrue(deleting.await(10, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> delete.get(200, TimeUnit.MILLISECONDS));
            } finally {
                release.countDown();
            }
            confirm.get(10, TimeUnit.SECONDS);
            ExecutionException refused = assertThrows(ExecutionException.class,
                    () -> delete.get(10, TimeUnit.SECONDS));
            assertTrue(refused.getCause() instanceof IllegalStateException);
        } finally {
            release.countDown();
        }
        assertEquals(1, deliveries.list(tenant, tripId).deliveries().get(0).proofs().size());
        assertEquals(documentId.toString(), documents.document(tenant, tripId, documentId).id());
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) {
                throw new IllegalStateException("confirmation latch timed out");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    @Test
    void aProofOfDeliveryAsksForTheStepAndCannotBeDeletedOnceConfirmed() {
        UUID tripId = newTrip();
        DeliveryViews.Delivery d = deliveries.create(tenant, ACTOR, tripId,
                new DeliveryService.NewDelivery("R-1", "Customer A", null, null, null, null));
        UUID deliveryId = UUID.fromString(d.id());
        TripDocument pod = upload(tripId, "PROOF_OF_DELIVERY", deliveryId, "pod.pdf", "application/pdf", PDF);
        assertEquals(d.id(), pod.deliveryId());

        DeliveryViews.Delivery after = deliveries.list(tenant, tripId).deliveries().get(0);
        assertEquals(1, after.proofs().size());
        assertEquals("pending", after.steps().get(0).status(), "the POD asks for the delivered step");
        assertEquals("trips:document:" + pod.id(), owner(pod.contentId()), "the document keeps its file");

        deliveries.confirm(tenant, ACTOR, tripId, deliveryId, "delivered", null, "ui", null, null);
        UUID podId = UUID.fromString(pod.id());
        assertThrows(IllegalStateException.class,
                () -> documents.delete(tenant, ACTOR, tripId, podId));
        assertTrue(documents.list(tenant, tripId).stream().anyMatch(x -> x.id().equals(pod.id())));
    }
}

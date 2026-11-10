package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.duty.InMemoryDutyStore;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector;
import com.microboxlabs.miot.symptoms.lostsignal.TripEnds;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * A case that closes because its trip ended keeps the trip it was opened on, its measure and, for the duty
 * counters, the counters of the trip's last frame, with why it closed. A case its rule closes during the trip is
 * recorded as before.
 */
class TripEndCloseTest {

    private static final String DEMO = "tenant-demo";
    private static final String OTHER = "tenant-other";
    private static final String ASSET = "DEMO01";
    private static final Instant T0 = Instant.parse("2026-10-22T00:00:00Z");
    private static final double METRES_PER_DEGREE = 6_371_000 * Math.PI / 180;

    private final InMemoryTransitionLog log = new InMemoryTransitionLog();
    private final InMemoryDutyStore duty = new InMemoryDutyStore();
    private final InMemoryEpisodeRepository episodes = new InMemoryEpisodeRepository();
    private SymptomCatalogService catalog;
    private EvaluatorStream stream;
    private int at;
    private double metres;

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        SymptomEvents events = new SymptomEvents(e -> CompletableFuture.completedFuture(e), store::findDefinition,
                Clock.systemUTC());
        DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
        catalog = new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
        stream = new EvaluatorStream(true, new EvaluatorCatalog(catalog, sources),
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()), Clock.systemUTC(),
                episodes, SignalSamples.inMemory(), LateFrames.NONE, LostSignalDetector.off(), Holds.NONE, duty);
    }

    private UUID template(String key) {
        return publish(key, SeedTemplates.get(key).spec());
    }

    private UUID delayedDriving() {
        SymptomSpec base = SeedTemplates.get("continuous-driving").spec();
        return publish("delayed-driving", new SymptomSpec(base.source(), base.activation(), base.measure(),
                base.levels(), new SymptomSpec.Lifecycle("case.condition_s >= 0", "case.normal_s >= 600"), null));
    }

    private UUID publish(String key, SymptomSpec spec) {
        UUID id = catalog.create(DEMO, "owner@example.com", new CreateRequest(key, key, null, null, null,
                spec.source(), null, spec)).definition().id();
        catalog.publish(DEMO, "owner@example.com", id, "Primera versión", null, SymptomState.TEST);
        return id;
    }

    private static String onTrip(String id, String extra) {
        return "{\"" + DEMO + "\":{\"id\":\"" + id + "\",\"active\":true,\"double_driver\":false" + extra + "}}";
    }

    private String frame(String trips, double speed) {
        return frame(trips, speed, DEMO);
    }

    private String frame(String trips, double speed, String client) {
        return """
                {"schema":"miot.gps.signal@1","asset_id":"%s","at":"%s","clients":["%s"],"trips":%s,
                 "frame":{"asset_id":"%s","gps":{"speed":%s,"latitude":%s,"longitude":0.0},"sensors":{}}}
                """.formatted(ASSET, T0.plusSeconds(at), client, trips, ASSET, speed,
                metres / METRES_PER_DEGREE);
    }

    /** One frame a minute, 1 km apart, on the trips given. */
    private void drive(int minutes, String trips) {
        drive(minutes, trips, DEMO);
    }

    private void drive(int minutes, String trips, String client) {
        for (int i = 0; i < minutes; i++) {
            at += 60;
            metres += 1000;
            stream.evaluate(frame(trips, 60, client));
        }
    }

    private void park(int minutes, String trips) {
        for (int i = 0; i < minutes; i++) {
            at += 60;
            stream.evaluate(frame(trips, 0));
        }
    }

    private int closedIndex(UUID symptom) {
        return IntStream.range(0, log.recorded.size())
                .filter(i -> log.recorded.get(i).definitionId().equals(symptom)
                        && log.recorded.get(i).kind() == Kind.CLOSED)
                .findFirst().orElseThrow();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> check(int index) {
        return (Map<String, Object>) log.contexts.get(index).get("check");
    }

    @Test
    void anEtaCaseClosedByItsTripsEndKeepsTheTripAndTheMeasure() {
        UUID late = template("eta-late");
        String trip = onTrip("T-1", ",\"eta_deviation_min\":150.0,\"destination\":{\"visited\":false}");
        drive(1, trip);
        drive(1, onTrip("T-1", ",\"eta_deviation_min\":200.0,\"destination\":{\"visited\":false}"));
        // Arrival: the activation stops holding, the case stays open until the trip is no longer active.
        drive(1, onTrip("T-1", ",\"eta_deviation_min\":0.0,\"destination\":{\"visited\":true}"));
        assertEquals(List.of(Kind.OPENED, Kind.LEVEL_CHANGED), log.recorded.stream().map(Transition::kind).toList());
        drive(1, "{}");

        int closed = closedIndex(late);
        assertEquals("T-1", log.places.get(closed).tripId(), "the case's trip, not the signal's none");
        assertEquals(200.0, log.recorded.get(closed).measure());
        assertEquals(Map.of("reason", TripEnds.REASON), log.contexts.get(closed));
        assertEquals("T-1", log.places.get(0).tripId());
    }

    @Test
    void aCaseClosedOnTheFrameWhereItsTripIsNoLongerActiveKeepsTheTrip() {
        UUID early = template("eta-early");
        drive(2, onTrip("T-1", ",\"eta_deviation_min\":-50.0"));
        // Arrival and trip end in the same frame: the trip is still in the signal, inactive.
        drive(1, "{\"" + DEMO + "\":{\"id\":\"T-1\",\"active\":false,\"double_driver\":false,"
                + "\"destination\":{\"visited\":true}}}");

        int closed = closedIndex(early);
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(50.0, log.recorded.get(closed).measure());
        assertEquals(TripEnds.REASON, log.contexts.get(closed).get("reason"));
    }

    @Test
    void aCaseItsRuleClosesDuringTheTripIsRecordedAsBefore() {
        UUID speed = publish("trip-speed", new SymptomSpec("gps_signal",
                "signal.trip.active && signal.frame.gps.speed >= 80",
                new SymptomSpec.Measure("signal.frame.gps.speed", "Velocidad", "km/h"),
                Specs.levels("true", "false", "false", "false"),
                new SymptomSpec.Lifecycle("case.condition_s >= 0", "case.normal_s >= 120"), null));
        String trip = onTrip("T-1", "");
        at += 60;
        stream.evaluate(frame(trip, 95));
        for (int i = 0; i < 3; i++) {
            at += 60;
            stream.evaluate(frame(trip, 50));
        }

        int closed = closedIndex(speed);
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(95.0, log.recorded.get(closed).measure());
        assertNull(log.contexts.get(closed), "no reason: the rule closed it on its trip");
        assertNull(log.recorded.get(closed).detail());
    }

    @Test
    void aDrivingCaseClosedAfterItsTripEndsKeepsTheTripsLastCounters() {
        UUID driving = template("continuous-driving");
        String trip = onTrip("T-1", "");
        drive(275, trip);
        Map<String, Object> onTheTrip = episodes.load(DEMO, ASSET).find(DEMO, ASSET, driving)
                .orElseThrow().lastContext();
        drive(11, "{}");

        int closed = closedIndex(driving);
        assertEquals(Kind.OPENED, log.recorded.get(0).kind());
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(274.0, log.recorded.get(closed).measure(), 0.01, "the highest measure, not the reset's 0");
        Map<String, Object> check = check(closed);
        assertEquals(((Map<?, ?>) onTheTrip.get("check")).get("driving_minutes"), check.get("driving_minutes"));
        assertEquals(((Map<?, ?>) onTheTrip.get("check")).get("duty_minutes"), check.get("duty_minutes"));
        assertTrue((double) check.get("duty_minutes") > 270, "the trip's counters, not the reset zeros");
        assertEquals(TripEnds.REASON, log.contexts.get(closed).get("reason"));
    }

    @Test
    void aDrivingCaseClosedOnTheNextTripKeepsItsOwnTripsCounters() {
        UUID driving = template("continuous-driving");
        drive(275, onTrip("T-1", ""));
        double lastDriving = (double) ((Map<?, ?>) episodes.load(DEMO, ASSET).find(DEMO, ASSET, driving)
                .orElseThrow().lastContext().get("check")).get("driving_minutes");
        drive(11, onTrip("T-2", ""));

        int closed = closedIndex(driving);
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(lastDriving, (double) check(closed).get("driving_minutes"));
        assertEquals(TripEnds.REASON, log.contexts.get(closed).get("reason"));
    }

    @Test
    void aDrivingCaseClosedAfterSignalAccessEndsKeepsTheTripAndItsCounters() {
        UUID driving = template("continuous-driving");
        drive(275, onTrip("T-1", ""));
        double lastDriving = (double) ((Map<?, ?>) episodes.load(DEMO, ASSET).find(DEMO, ASSET, driving)
                .orElseThrow().lastContext().get("check")).get("driving_minutes");
        // The organization no longer receives the vehicle: the reconcile closes the case.
        drive(12, "{}", OTHER);

        int closed = closedIndex(driving);
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(lastDriving, (double) check(closed).get("driving_minutes"));
        assertEquals(TripEnds.REASON, log.contexts.get(closed).get("reason"));
    }

    @Test
    void aDrivingCaseARestClosesDuringTheTripKeepsTheFramesCounters() {
        UUID driving = template("continuous-driving");
        String trip = onTrip("T-1", "");
        drive(275, trip);
        park(60, trip);

        int closed = closedIndex(driving);
        assertEquals("T-1", log.places.get(closed).tripId());
        Map<String, Object> context = log.contexts.get(closed);
        assertNull(context.get("reason"));
        assertTrue((double) check(closed).get("driving_minutes") < 270, "the closing frame's counters");
    }

    @Test
    void threeSuccessiveTripsDoNotEvictAnOpenCasesCounters() {
        UUID driving = delayedDriving();
        drive(275, onTrip("T-1", ""));
        Map<String, Object> kept = episodes.load(DEMO, ASSET).find(DEMO, ASSET, driving)
                .orElseThrow().lastContext();
        drive(2, onTrip("T-2", ""));
        drive(2, onTrip("T-3", ""));
        assertTrue(log.recorded.stream().noneMatch(t -> t.kind() == Kind.CLOSED));
        drive(7, onTrip("T-4", ""));

        int closed = closedIndex(driving);
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(kept.get("check"), log.contexts.get(closed).get("check"));
        assertEquals(274.0, log.recorded.get(closed).measure());
    }

    @Test
    void lastDutyFrameKeepsItsTenantGeoAndIsIndependentOfTheMaximum() {
        UUID driving = delayedDriving();
        drive(275, onTrip("T-1", ""));
        park(25, onTrip("T-1", ""));
        at += 60;
        String json = frame(onTrip("T-1", ""), 0).replace("\"frame\":", "\"geos\":{\"" + DEMO
                + "\":{\"zone\":\"Synthetic zone\"},\"" + OTHER
                + "\":{\"zone\":\"Other synthetic zone\"}},\"frame\":");
        stream.evaluate(json);
        Map<String, Object> kept = episodes.load(DEMO, ASSET).find(DEMO, ASSET, driving)
                .orElseThrow().lastContext();
        drive(11, "{}");

        int closed = closedIndex(driving);
        assertEquals(kept.get("check"), log.contexts.get(closed).get("check"));
        assertEquals(Map.of("zone", "Synthetic zone"), check(closed).get("geo"));
        assertEquals(275.0, log.recorded.get(closed).measure(), "CLOSED is the maximum, context is the last frame");
        assertTrue((double) check(closed).get("driving_minutes") < 275.0);
    }

    @Test
    void gpsReconcileUsesTheEstablishedTripEndReason() {
        UUID late = template("eta-late");
        drive(1, onTrip("T-1", ",\"eta_deviation_min\":150.0"));
        drive(1, "{}", OTHER);
        int closed = closedIndex(late);
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(150.0, log.recorded.get(closed).measure());
        assertEquals(Map.of("reason", TripEnds.REASON), log.contexts.get(closed));
    }

    @Test
    void expiringAnAllCasesHoldKeepsEachCasesTripAndDutyContext() {
        UUID driving = delayedDriving();
        drive(275, onTrip("T-1", ""));
        Map<String, Object> kept = episodes.load(DEMO, ASSET).find(DEMO, ASSET, driving)
                .orElseThrow().lastContext();
        drive(1, onTrip("T-2", ""));
        var hold = new com.microboxlabs.miot.symptoms.cases.IgnoreHold("hold-demo", DEMO, 1, ASSET, driving,
                "hold-trip", com.microboxlabs.miot.symptoms.cases.IgnoreHold.Scope.ALL,
                T0.plusSeconds(at), "owner@example.com", 600, false, false);
        assertTrue(log.recorded.stream().noneMatch(t -> t.kind() == Kind.CLOSED));
        stream.finishHold(hold);

        int closed = closedIndex(driving);
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(274.0, log.recorded.get(closed).measure());
        assertEquals(kept.get("check"), log.contexts.get(closed).get("check"));
        assertEquals(TripEnds.REASON, log.contexts.get(closed).get("reason"));
    }

    @Test
    void aLegacyCaseDoesNotAdoptTheNextTripsIdentity() {
        UUID driving = delayedDriving();
        drive(275, onTrip("T-1", ""));
        AssetEpisodes state = episodes.load(DEMO, ASSET);
        state.save(DEMO, RedisEpisodes.read(oldEpisode(state.find(DEMO, ASSET, driving).orElseThrow())));
        episodes.save(state);
        drive(11, onTrip("T-2", ""));
        assertEquals("T-1", log.places.get(closedIndex(driving)).tripId());
    }

    @Test
    void aLegacyOffTripCaseKeepsTheTripEndReasonWhenAHoldExpires() {
        UUID driving = delayedDriving();
        drive(275, onTrip("T-1", ""));
        drive(1, "{}");
        AssetEpisodes state = episodes.load(DEMO, ASSET);
        state.save(DEMO, RedisEpisodes.read(oldEpisode(state.find(DEMO, ASSET, driving).orElseThrow())));
        episodes.save(state);
        var hold = new com.microboxlabs.miot.symptoms.cases.IgnoreHold("hold-demo", DEMO, 1, ASSET, driving,
                "T-1", com.microboxlabs.miot.symptoms.cases.IgnoreHold.Scope.CASE,
                T0.plusSeconds(at), "owner@example.com", 600, false, false);
        stream.finishHold(hold);
        int closed = closedIndex(driving);
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(274.0, log.recorded.get(closed).measure());
        assertEquals(TripEnds.REASON, log.contexts.get(closed).get("reason"));
    }

    private static String oldEpisode(Episode e) {
        var json = new io.vertx.core.json.JsonObject(RedisEpisodes.write(e));
        json.remove("tripId");
        json.remove("lastContext");
        json.remove("tripEnded");
        return json.encode();
    }

    @Test
    void aLegacyCaseRecoversItsTripFromItsOpening() {
        UUID late = template("eta-late");
        String trip = onTrip("T-1", ",\"eta_deviation_min\":150.0");
        drive(1, trip);
        // As the running version wrote it: no trip on the episode.
        Episode e = episodes.load(DEMO, ASSET).find(DEMO, ASSET, late).orElseThrow();
        String old = oldEpisode(e);
        assertTrue(!old.contains("tripId"));
        Episode written = RedisEpisodes.read(old);
        assertNull(written.tripId());
        AssetEpisodes state = episodes.load(DEMO, ASSET);
        state.save(DEMO, written);
        episodes.save(state);

        drive(1, trip);
        assertEquals("T-1", episodes.load(DEMO, ASSET).find(DEMO, ASSET, late).orElseThrow().tripId());
        drive(1, "{}");
        assertEquals("T-1", log.places.get(closedIndex(late)).tripId());
    }

    @Test
    void aLegacyCaseClosedOffTripRecoversItsOpeningTrip() {
        UUID late = template("eta-late");
        drive(1, onTrip("T-1", ",\"eta_deviation_min\":150.0"));
        Episode e = episodes.load(DEMO, ASSET).find(DEMO, ASSET, late).orElseThrow();
        AssetEpisodes state = episodes.load(DEMO, ASSET);
        state.save(DEMO, RedisEpisodes.read(oldEpisode(e)));
        episodes.save(state);

        drive(1, "{}");
        int closed = closedIndex(late);
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(TripEnds.REASON, log.contexts.get(closed).get("reason"));
    }
}

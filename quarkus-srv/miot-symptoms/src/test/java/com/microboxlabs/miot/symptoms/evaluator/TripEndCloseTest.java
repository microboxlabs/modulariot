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
import com.microboxlabs.miot.symptoms.duty.DutyState;
import com.microboxlabs.miot.symptoms.duty.InMemoryDutyStore;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector;
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
                 "frame":{"asset_id":"%s","gps":{"speed":%s,"latitude":%s,"longitude":-70.6},"sensors":{}}}
                """.formatted(ASSET, T0.plusSeconds(at), client, trips, ASSET, speed,
                -40 + metres / METRES_PER_DEGREE);
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
        assertEquals(Map.of(EvaluatorStream.CLOSED_REASON, EvaluatorStream.TRIP_ENDED), log.contexts.get(closed));
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
        assertEquals(EvaluatorStream.TRIP_ENDED, log.contexts.get(closed).get(EvaluatorStream.CLOSED_REASON));
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
        DutyState onTheTrip = duty.load(DEMO, ASSET).state();
        drive(11, "{}");

        int closed = closedIndex(driving);
        assertEquals(Kind.OPENED, log.recorded.get(0).kind());
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(274.0, log.recorded.get(closed).measure(), 0.01, "the highest measure, not the reset's 0");
        Map<String, Object> check = check(closed);
        assertEquals(onTheTrip.last().drivingMinutes(), (double) check.get("driving_minutes"));
        assertEquals(onTheTrip.last().dutyMinutes(), (double) check.get("duty_minutes"));
        assertTrue((double) check.get("duty_minutes") > 270, "the trip's counters, not the reset zeros");
        assertEquals(EvaluatorStream.TRIP_ENDED, log.contexts.get(closed).get(EvaluatorStream.CLOSED_REASON));
    }

    @Test
    void aDrivingCaseClosedOnTheNextTripKeepsItsOwnTripsCounters() {
        UUID driving = template("continuous-driving");
        drive(275, onTrip("T-1", ""));
        double lastDriving = duty.load(DEMO, ASSET).state().last().drivingMinutes();
        drive(11, onTrip("T-2", ""));

        int closed = closedIndex(driving);
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(lastDriving, (double) check(closed).get("driving_minutes"));
        assertEquals(EvaluatorStream.TRIP_ENDED, log.contexts.get(closed).get(EvaluatorStream.CLOSED_REASON));
    }

    @Test
    void aDrivingCaseClosedAfterSignalAccessEndsKeepsTheTripAndItsCounters() {
        UUID driving = template("continuous-driving");
        drive(275, onTrip("T-1", ""));
        double lastDriving = duty.load(DEMO, ASSET).state().last().drivingMinutes();
        // The organization no longer receives the vehicle: the reconcile closes the case.
        drive(12, "{}", OTHER);

        int closed = closedIndex(driving);
        assertEquals("T-1", log.places.get(closed).tripId());
        assertEquals(lastDriving, (double) check(closed).get("driving_minutes"));
        assertEquals(EvaluatorStream.ACCESS_ENDED, log.contexts.get(closed).get(EvaluatorStream.CLOSED_REASON));
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
        assertNull(context.get(EvaluatorStream.CLOSED_REASON));
        assertTrue((double) check(closed).get("driving_minutes") < 270, "the closing frame's counters");
    }

    @Test
    void aCaseOpenedBeforeTheTripWasKeptTakesItFromItsNextFrameOnTheTrip() {
        UUID late = template("eta-late");
        String trip = onTrip("T-1", ",\"eta_deviation_min\":150.0");
        drive(1, trip);
        // As the running version wrote it: no trip on the episode.
        Episode e = episodes.load(DEMO, ASSET).find(DEMO, ASSET, late).orElseThrow();
        String old = RedisEpisodes.write(e).replace(",\"tripId\":\"T-1\"", "");
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
    void aCaseOpenedBeforeTheTripWasKeptAndClosedOffItHasNoTripAsBefore() {
        UUID late = template("eta-late");
        drive(1, onTrip("T-1", ",\"eta_deviation_min\":150.0"));
        Episode e = episodes.load(DEMO, ASSET).find(DEMO, ASSET, late).orElseThrow();
        AssetEpisodes state = episodes.load(DEMO, ASSET);
        state.save(DEMO, RedisEpisodes.read(RedisEpisodes.write(e).replace(",\"tripId\":\"T-1\"", "")));
        episodes.save(state);

        drive(1, "{}");
        int closed = closedIndex(late);
        assertNull(log.places.get(closed).tripId());
        assertNull(log.contexts.get(closed));
    }
}

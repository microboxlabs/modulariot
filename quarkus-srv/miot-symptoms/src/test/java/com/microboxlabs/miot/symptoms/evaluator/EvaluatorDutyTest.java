package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.duty.DutyChecks;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The duty counters on each frame, through the evaluator, with the continuous-driving and resting templates. */
class EvaluatorDutyTest {

    private static final String DEMO = "tenant-demo";
    private static final String ASSET = "DEMO01";
    private static final Instant T0 = Instant.parse("2026-10-22T00:00:00Z");
    private static final double METRES_PER_DEGREE = 6_371_000 * Math.PI / 180;

    private final InMemoryTransitionLog log = new InMemoryTransitionLog();
    private final InMemoryDutyStore duty = new InMemoryDutyStore();
    private SymptomCatalogService catalog;
    private EvaluatorCatalog evaluatorCatalog;
    private EvaluatorStream stream;
    private UUID driving;
    private UUID resting;
    private int at;
    private double metres;

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        SymptomEvents events = new SymptomEvents(e -> CompletableFuture.completedFuture(e), store::findDefinition,
                Clock.systemUTC());
        DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
        catalog = new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
        evaluatorCatalog = new EvaluatorCatalog(catalog, sources);
        driving = publish("continuous-driving");
        resting = publish("continuous-resting");
        stream = new EvaluatorStream(true, evaluatorCatalog,
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()), Clock.systemUTC(),
                new InMemoryEpisodeRepository(), SignalSamples.inMemory(), LateFrames.NONE, LostSignalDetector.off(),
                Holds.NONE, duty);
    }

    private UUID publish(String key) {
        var id = catalog.create(DEMO, "owner@example.com", new CreateRequest(key, key, null, null, null,
                "trip_check", null, SeedTemplates.get(key).spec())).definition().id();
        catalog.publish(DEMO, "owner@example.com", id, "Primera versión", null, SymptomState.TEST);
        return id;
    }

    private static String frame(int seconds, double metres) {
        return """
                {"schema":"miot.gps.signal@1","asset_id":"%s","at":"%s","clients":["%s"],
                 "trips":{"%s":{"id":"T-1","active":true,"double_driver":false}},
                 "frame":{"asset_id":"%s","gps":{"speed":60.0,"latitude":%s,"longitude":-70.6},"sensors":{}}}
                """.formatted(ASSET, T0.plusSeconds(seconds), DEMO, DEMO, ASSET, -60 + metres / METRES_PER_DEGREE);
    }

    private void drive(int minutes) {
        for (int i = 0; i < minutes; i++) {
            at += 60;
            metres += 1000;
            stream.evaluate(frame(at, metres));
        }
    }

    private void park(int minutes) {
        for (int i = 0; i < minutes; i++) {
            at += 60;
            stream.evaluate(frame(at, metres));
        }
    }

    private List<Transition> of(UUID symptom) {
        return log.recorded.stream().filter(t -> t.definitionId().equals(symptom)).toList();
    }

    @Test
    void drivingOpensAtFourAndAHalfHoursAndARestLowersAndClosesIt() {
        stream.evaluate(frame(0, 0));
        drive(269);
        assertTrue(of(driving).isEmpty());
        drive(1);
        Transition opened = of(driving).get(0);
        assertEquals(Kind.OPENED, opened.kind());
        assertEquals(T0.plusSeconds(270 * 60), opened.at());
        assertEquals(1, opened.level());
        drive(90);
        assertEquals(List.of(1, 2, 3, 4), of(driving).stream().map(Transition::level).toList());
        // 361 min driving; at 24 min of rest 60 min are paid back, then 2.5 min per minute of rest.
        park(38);
        assertEquals(List.of(Kind.OPENED, Kind.LEVEL_CHANGED, Kind.LEVEL_CHANGED, Kind.LEVEL_CHANGED,
                Kind.LEVEL_CHANGED, Kind.LEVEL_CHANGED, Kind.CLOSED), of(driving).stream().map(Transition::kind).toList());
        assertEquals(List.of(1, 2, 3, 4, 2, 1, 1), of(driving).stream().map(Transition::level).toList());
        assertEquals(T0.plusSeconds((361 + 37) * 60), of(driving).get(6).at(), "closes under 270 min");
    }

    @Test
    void theCaseKeepsTheCountersItWasOpenedWith() {
        stream.evaluate(frame(0, 0));
        drive(270);
        int opened = log.recorded.indexOf(of(driving).get(0));
        @SuppressWarnings("unchecked")
        Map<String, Object> check = (Map<String, Object>) log.contexts.get(opened).get("check");
        assertEquals(270.0, (Double) check.get("driving_minutes"), 0.01);
        assertFalse(check.containsKey("trip"), "the trip is the case's");
    }

    @Test
    void pastSixteenHoursAndAQuarterOnDutyRestingOpensAndAnOperatorCloseRestartsTheDuty() {
        stream.evaluate(frame(0, 0));
        for (int i = 0; i < 3; i++) {
            drive(239);
            park(5);
        }
        drive(242);
        assertTrue(of(resting).isEmpty(), "974 min of duty, stops included");
        drive(1);
        assertEquals(Kind.OPENED, of(resting).get(0).kind());
        assertEquals(4, of(resting).get(0).level(), "driving: no rest");

        stream.forget(DEMO, ASSET, resting);
        drive(60);
        assertEquals(1, of(resting).size(), "duty counts again from the close");
    }

    @Test
    void replaysAndOlderFramesChangeNothing() {
        stream.evaluate(frame(0, 0));
        drive(270);
        int recorded = log.recorded.size();
        stream.evaluate(frame(at, metres));
        stream.evaluate(frame(at - 600, metres - 10_000));
        assertEquals(recorded, log.recorded.size());
        drive(1);
        assertEquals(recorded, log.recorded.size(), "the next frame still reads 271 min: level 1, no change");
    }

    @Test
    void onlyTheSymptomsThatReadTheCountersRunOnFrames() {
        var symptoms = evaluatorCatalog.forSource(DEMO, "trip_check").symptoms();
        assertTrue(symptoms.stream().allMatch(DutyChecks::readsCounters));
        assertEquals(List.of(resting), symptoms.stream().filter(DutyChecks::readsDuty)
                .map(CompiledSymptom::definitionId).toList());
        var lost = CompiledSymptom.compile(UUID.randomUUID(), "1.0.0", SymptomState.TEST,
                SeedTemplates.get("signal-loss").spec(), new DataSourceService(new InMemoryCatalog(),
                        SignalSamples.inMemory()).find(DEMO, "trip_check").orElseThrow());
        assertFalse(DutyChecks.readsCounters(lost), "the lost-signal checks run it");
    }
}

package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.duty.DutyChecks;
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
import java.util.ArrayList;
import java.util.Collections;
import java.util.ConcurrentModificationException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
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
    private SymptomEvents events;
    private final InMemoryEpisodeRepository episodes = new InMemoryEpisodeRepository();
    private UUID driving;
    private UUID resting;
    private int at;
    private double metres;

    @BeforeEach
    void setUp() {
        InMemoryCatalog store = new InMemoryCatalog();
        events = new SymptomEvents(e -> CompletableFuture.completedFuture(e), store::findDefinition,
                Clock.systemUTC());
        DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
        catalog = new SymptomCatalogService(store, sources, new AuditService(new InMemoryAuditStore()));
        evaluatorCatalog = new EvaluatorCatalog(catalog, sources);
        driving = publish("continuous-driving");
        resting = publish("continuous-resting");
        stream = new EvaluatorStream(true, evaluatorCatalog,
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()), Clock.systemUTC(),
                episodes, SignalSamples.inMemory(), LateFrames.NONE, LostSignalDetector.off(), Holds.NONE, duty);
    }

    private UUID publish(String key) {
        var id = catalog.create(DEMO, "owner@example.com", new CreateRequest(key, key, null, null, null,
                "trip_check", null, SeedTemplates.get(key).spec())).definition().id();
        catalog.publish(DEMO, "owner@example.com", id, "Primera versión", null, SymptomState.TEST);
        return id;
    }

    /** Each organization's zones on the frames, as the signal builder publishes them; none when null. */
    private String geos;

    private String frame(int seconds, double metres) {
        return """
                {"schema":"miot.gps.signal@1","asset_id":"%s","at":"%s","clients":["%s"],
                 "trips":{"%s":{"id":"T-1","active":true,"double_driver":false}},%s
                 "frame":{"asset_id":"%s","gps":{"speed":60.0,"latitude":%s,"longitude":-70.6},"sensors":{}}}
                """.formatted(ASSET, T0.plusSeconds(seconds), DEMO, DEMO,
                geos == null ? "" : "\"geos\":" + geos + ",", ASSET, -60 + metres / METRES_PER_DEGREE);
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
    void framesBufferedDuringAStopAndSentNewestFirstOpenNoDrivingCase() {
        stream.evaluate(frame(0, 0));
        drive(240);
        int quiet = at;
        double stop = metres + 10_000;
        // Quiet for 4 h: 10 min to a stop, stopped 3 h, moving 30 min; then everything at once, newest first.
        List<String> buffered = new ArrayList<>();
        for (int m = 1; m <= 10; m++) {
            buffered.add(frame(quiet + m * 60, metres + m * 1000));
        }
        for (int m = 11; m <= 190; m++) {
            buffered.add(frame(quiet + m * 60, stop));
        }
        for (int m = 191; m <= 240; m++) {
            buffered.add(frame(quiet + m * 60, stop + (m - 190) * 1000));
        }
        Collections.reverse(buffered);
        buffered.forEach(stream::evaluate);
        at = quiet + 240 * 60;
        metres = stop + 50 * 1000;
        drive(20);
        assertEquals(List.of(), of(driving), "240 + 20 min of observed driving, under 270");
    }

    @Test
    void aFarFrameIsKeptAndTheNextOneThatAgreesStartsFromIt() {
        stream.evaluate(frame(0, 0));
        stream.evaluate(frame(1200, 60_000));
        DutyState kept = duty.load(DEMO, ASSET).state();
        assertEquals(T0, kept.at(), "60 km in 20 min: not applied");
        assertEquals(T0.plusSeconds(1200), kept.skipped().at(), "but kept");
        at = 1200;
        metres = 60_000;
        drive(269);
        assertEquals(List.of(), of(driving), "the 20 min before the far frame are not driving");
        drive(1);
        assertEquals(T0.plusSeconds(1200 + 270 * 60), of(driving).get(0).at());
        assertNull(duty.load(DEMO, ASSET).state().skipped());
    }

    @Test
    void rejectedAndConfirmingFramesUseOneDutyReadAndOneWriteEach() {
        AtomicInteger loads = new AtomicInteger();
        AtomicInteger saves = new AtomicInteger();
        InMemoryDutyStore counting = new InMemoryDutyStore() {
            @Override
            public Loaded load(String tenant, String asset) {
                loads.incrementAndGet();
                return duty.load(tenant, asset);
            }

            @Override
            public void save(String tenant, String asset, DutyState state) {
                saves.incrementAndGet();
                duty.save(tenant, asset, state);
            }
        };
        stream = new EvaluatorStream(true, evaluatorCatalog,
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()), Clock.systemUTC(), episodes,
                SignalSamples.inMemory(), LateFrames.NONE, LostSignalDetector.off(), Holds.NONE, counting);
        stream.evaluate(frame(0, 0));
        stream.evaluate(frame(1200, 60_000));
        assertEquals(T0, episodes.load(DEMO, ASSET).watermark(DEMO, ASSET, DutyChecks.WATERMARK).orElseThrow(),
                "the rejected frame does not evaluate duty symptoms");
        stream.evaluate(frame(1230, 60_500));
        assertEquals(3, loads.get());
        assertEquals(3, saves.get(), "promotion performs no extra store operations");
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

    /** A continuous-driving rule that is quiet while the frame is in one of the organization's authorized zones. */
    private UUID publishOutsideZones() throws Exception {
        SymptomSpec spec = new ObjectMapper().readValue("""
                {"source":"trip_check",
                 "activation":"check.trip.active && check.driving_minutes >= 270 && !check.?geo.?authorized_zone.orValue(false)",
                 "levels":[{"icu":1,"applies":true,"when":"true"}],
                 "lifecycle":{"open":"case.condition_s >= 0","close":"case.normal_s >= 0","levelDown":true}}
                """, SymptomSpec.class);
        var id = catalog.create(DEMO, "owner@example.com", new CreateRequest("driving-outside-zones",
                "driving-outside-zones", null, null, null, "trip_check", null, spec)).definition().id();
        catalog.publish(DEMO, "owner@example.com", id, "Primera versión", null, SymptomState.TEST);
        return id;
    }

    @Test
    void aRuleOnTheFramesZoneOpensOutsideTheZoneAndNotInsideWhileTheTimeCounts() throws Exception {
        UUID outsideZones = publishOutsideZones();
        geos = """
                {"%s":{"authorized_zone":true,"zone":"Base"},"tenant-other":{"authorized_zone":false}}"""
                .formatted(DEMO);
        stream.evaluate(frame(0, 0));
        drive(280);
        assertEquals(List.of(), of(outsideZones), "inside its authorized zone");
        Transition opened = of(driving).get(0);
        assertEquals(T0.plusSeconds(270 * 60), opened.at(), "the template counts the time inside the zone");
        @SuppressWarnings("unchecked")
        Map<String, Object> check = (Map<String, Object>) log.contexts.get(log.recorded.indexOf(opened)).get("check");
        assertEquals(Map.of("authorized_zone", true, "zone", "Base"), check.get("geo"));

        geos = """
                {"%s":{"authorized_zone":false},"tenant-other":{"authorized_zone":true}}""".formatted(DEMO);
        drive(1);
        assertEquals(Kind.OPENED, of(outsideZones).get(0).kind(), "out of its zone, another's does not count");
        assertEquals(T0.plusSeconds(281 * 60), of(outsideZones).get(0).at());
    }

    @Test
    void aRuleOnTheFramesZoneOpensOnFramesWithoutZones() throws Exception {
        UUID outsideZones = publishOutsideZones();
        stream.evaluate(frame(0, 0));
        drive(270);
        assertEquals(Kind.OPENED, of(outsideZones).get(0).kind());
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
    void losingSignalAccessClosesDutyCasesAndEndsTheirTrip() {
        stream.evaluate(frame(0, 0));
        drive(975);
        assertTrue(episodes.load(DEMO, ASSET).find(DEMO, ASSET, driving).orElseThrow().open());
        assertTrue(episodes.load(DEMO, ASSET).find(DEMO, ASSET, resting).orElseThrow().open());
        int recorded = log.recorded.size();
        String gone = frame(at + 60, metres)
                .replace("\"clients\":[\"" + DEMO + "\"]", "\"clients\":[]");

        assertEquals(2, stream.evaluate(gone));
        assertEquals(Kind.CLOSED, of(driving).get(of(driving).size() - 1).kind());
        assertEquals(Kind.CLOSED, of(resting).get(of(resting).size() - 1).kind());
        assertNull(duty.load(DEMO, ASSET).state().drive());
        assertNull(duty.load(DEMO, ASSET).state().rest());
        assertEquals(0, stream.evaluate(gone), "a reconciliation replay publishes nothing twice");
        at += 120;
        stream.evaluate(frame(at, metres));
        assertEquals(recorded + 2, log.recorded.size(), "the same trip starts with fresh counters on return");
    }

    @Test
    void olderFramesCannotReconcileNewerDutyCases() {
        stream.evaluate(frame(0, 0));
        drive(270);
        var before = duty.load(DEMO, ASSET).state();
        String old = frame(at - 60, metres)
                .replace("\"clients\":[\"" + DEMO + "\"]", "\"clients\":[]");

        assertEquals(0, stream.evaluate(old));
        assertEquals(1, of(driving).size());
        assertEquals(before, duty.load(DEMO, ASSET).state());
    }

    @Test
    void aFailedDutyWriteReplaysAfterTheEpisodeWriteAndSurvivesAConsumerRestart() {
        stream.evaluate(frame(0, 0));
        drive(269);
        InMemoryDutyStore failing = new InMemoryDutyStore() {
            @Override
            public Loaded load(String tenant, String asset) {
                return duty.load(tenant, asset);
            }

            @Override
            public void save(String tenant, String asset, DutyState state) {
                throw new IllegalStateException("Redis down");
            }
        };
        EvaluatorStream broken = new EvaluatorStream(true, evaluatorCatalog,
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()), Clock.systemUTC(), episodes,
                SignalSamples.inMemory(), LateFrames.NONE, LostSignalDetector.off(), Holds.NONE, failing);
        String opening = frame(at + 60, metres + 1000);
        assertThrows(IllegalStateException.class, () -> broken.evaluate(opening));
        assertEquals(1, of(driving).size());
        assertEquals(T0.plusSeconds(at), duty.load(DEMO, ASSET).state().at(), "the state write failed");

        stream = new EvaluatorStream(true, evaluatorCatalog,
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()), Clock.systemUTC(), episodes,
                SignalSamples.inMemory(), LateFrames.NONE, LostSignalDetector.off(), Holds.NONE, duty);
        assertEquals(0, stream.evaluate(opening), "the saved watermark suppresses the replayed transition");
        assertEquals(T0.plusSeconds(at + 60), duty.load(DEMO, ASSET).state().at());
        assertEquals(1, of(driving).size());
        at += 60;
        metres += 1000;
        drive(30);
        assertEquals(List.of(1, 2), of(driving).stream().map(Transition::level).toList(),
                "the next level includes the replayed minute exactly once");
    }

    @Test
    void anOperatorCloseDuringTheDutyReadCannotReopenItsCase() {
        stream.evaluate(frame(0, 0));
        drive(975);
        AtomicBoolean close = new AtomicBoolean(true);
        InMemoryDutyStore interleaving = new InMemoryDutyStore() {
            @Override
            public Loaded load(String tenant, String asset) {
                Loaded loaded = duty.load(tenant, asset);
                if (close.getAndSet(false)) {
                    stream.forget(tenant, asset, resting);
                }
                return loaded;
            }

            @Override
            public void save(String tenant, String asset, DutyState state) {
                duty.save(tenant, asset, state);
            }

            @Override
            public void restartDuty(String tenant, String asset) {
                duty.restartDuty(tenant, asset);
            }
        };
        stream = new EvaluatorStream(true, evaluatorCatalog,
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()), Clock.systemUTC(), episodes,
                SignalSamples.inMemory(), LateFrames.NONE, LostSignalDetector.off(), Holds.NONE, interleaving);
        String next = frame(at + 60, metres + 1000);

        assertThrows(ConcurrentModificationException.class, () -> stream.evaluate(next));
        assertEquals(1, of(resting).size(), "no reopening was logged before the invalidated save");
        assertEquals(0, stream.evaluate(next), "the replay sees the restart");
        assertEquals(1, of(resting).size());
        assertEquals(1, duty.load(DEMO, ASSET).state().restarts());
        assertEquals(0.0, duty.load(DEMO, ASSET).state().rest().dutyS());
    }

    @Test
    void aFrameAfterEpisodeCloseAlreadySeesTheDutyRestart() {
        stream.evaluate(frame(0, 0));
        drive(975);
        InMemoryEpisodeRepository interleaving = new InMemoryEpisodeRepository() {
            @Override
            public AssetEpisodes load(String tenant, String asset) {
                return episodes.load(tenant, asset);
            }

            @Override
            public void save(AssetEpisodes changes) {
                episodes.save(changes);
            }

            @Override
            public void operatorClose(String tenant, String asset, UUID id, Episode marker) {
                episodes.operatorClose(tenant, asset, id, marker);
                assertEquals(0, stream.evaluate(frame(at + 60, metres + 1000)));
            }
        };
        stream = new EvaluatorStream(true, evaluatorCatalog,
                new EvaluatorStream.Sinks(log, events, new SimpleMeterRegistry()), Clock.systemUTC(), interleaving,
                SignalSamples.inMemory(), LateFrames.NONE, LostSignalDetector.off(), Holds.NONE, duty);

        stream.forget(DEMO, ASSET, resting);

        assertEquals(1, of(resting).size(), "an interleaved frame cannot publish a new case");
        assertEquals(1, duty.load(DEMO, ASSET).state().restarts());
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

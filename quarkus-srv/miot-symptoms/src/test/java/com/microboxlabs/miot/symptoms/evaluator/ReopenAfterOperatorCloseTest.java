package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.lostsignal.InMemoryLossStore;
import com.microboxlabs.miot.symptoms.lostsignal.LossSettings;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector.TickerSettings;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector;
import com.microboxlabs.miot.symptoms.lostsignal.TripChecks;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.redis.client.Redis;
import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.redis.client.RedisOptions;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * A case an operator closes does not reopen while its condition holds on the same trip. The rule is production's
 * continuous-driving rule (open {@code case.condition_s >= 0}, close {@code case.normal_s >= 0}, level down), with
 * the frame's speed standing in for the net driving minutes: from 270 a case, level 2 at 300, 3 at 330, 4 at 360.
 */
class ReopenAfterOperatorCloseTest {

    private static final String TENANT = "tenant-a";
    private static final String ASSET = "vehicle-" + UUID.randomUUID();
    private static final String TRIP = "T-1";
    private static final Instant T0 = Instant.parse("2026-10-22T14:08:45Z");
    private static final String MINUTES = "signal.frame.gps.speed";
    private static final SymptomSpec.Lifecycle LIFECYCLE = new SymptomSpec.Lifecycle("case.condition_s >= 0",
            "case.normal_s >= 0", true);

    private final InMemoryTransitionLog log = new InMemoryTransitionLog();
    private EvaluatorCatalog catalog;
    private SymptomEvents events;
    private UUID id;

    private void publish(SymptomSpec.Lifecycle lifecycle) {
        publish(new SymptomSpec("gps_signal", "signal.trip.active && " + MINUTES + " >= 270.0", null,
                Specs.levels(MINUTES + " < 300.0", MINUTES + " >= 300.0 && " + MINUTES + " < 330.0",
                        MINUTES + " >= 330.0 && " + MINUTES + " < 360.0", MINUTES + " >= 360.0"),
                lifecycle, null));
    }

    private void publish(SymptomSpec spec) {
        InMemoryCatalog store = new InMemoryCatalog();
        events = new SymptomEvents(e -> CompletableFuture.completedFuture(null), store::findDefinition,
                Clock.systemUTC());
        DataSourceService sources = new DataSourceService(store, SignalSamples.inMemory());
        SymptomCatalogService symptoms = new SymptomCatalogService(store, sources,
                new AuditService(new InMemoryAuditStore()));
        id = symptoms.create(TENANT, "owner@example.com", new CreateRequest("continuous-driving", "Conducción",
                null, null, null, "gps_signal", null, spec)).definition().id();
        symptoms.publish(TENANT, "owner@example.com", id, "Primera versión", null, SymptomState.ACTIVE);
        catalog = new EvaluatorCatalog(symptoms, sources);
    }

    /** The GPS consumer with its own episodes; a new one with new episodes is a restart. */
    private EvaluatorStream consumer() {
        return consumer(new InMemoryEpisodeRepository());
    }

    private EvaluatorStream consumer(EpisodeRepository repository) {
        return consumer(repository, Holds.NONE);
    }

    private EvaluatorStream consumer(EpisodeRepository repository, Holds holds) {
        SimpleMeterRegistry meters = new SimpleMeterRegistry();
        Clock clock = Clock.systemUTC();
        TripChecks checks = new TripChecks(catalog, repository, log, events,
                new AuditService(new InMemoryAuditStore()), meters);
        LostSignalDetector detector = new LostSignalDetector(true, new InMemoryLossStore(), LossSettings.defaults(),
                TickerSettings.defaults(), checks, meters, clock);
        return new EvaluatorStream(true, catalog, new EvaluatorStream.Sinks(log, events, meters), clock,
                repository, SignalSamples.inMemory(), LateFrames.NONE, detector, holds);
    }

    private static String signal(int second, double minutes, String trip) {
        return """
                {"schema":"miot.gps.signal@1","asset_id":"%s","at":"%s","clients":["%s"],
                 "trips":{"%s":{"id":"%s","active":true,"double_driver":false}},
                 "frame":{"asset_id":"%s","gps":{"speed":%s},"sensors":{}}}
                """.formatted(ASSET, T0.plusSeconds(second), TENANT, TENANT, trip, ASSET, minutes);
    }

    /** The signals, each a second apart from {@code from}, on the trip; what they recorded. */
    private List<String> drive(EvaluatorStream consumer, int from, double... minutes) {
        return drive(consumer, TRIP, from, minutes);
    }

    private List<String> drive(EvaluatorStream consumer, String trip, int from, double... minutes) {
        int before = log.recorded.size();
        for (int i = 0; i < minutes.length; i++) {
            consumer.evaluate(signal(from + i, minutes[i], trip));
        }
        return log.recorded.subList(before, log.recorded.size()).stream()
                .map(t -> t.kind() + ":" + t.level()).toList();
    }

    /** What the case service does on an operator's close: the marker, then the CLOSED row with how it closed. */
    private void operatorCloses(EvaluatorStream consumer, int second, int level, boolean invalidated) {
        OperatorClose how = new OperatorClose(TRIP, T0.plusSeconds(second), level, invalidated);
        consumer.closedByOperator(TENANT, ASSET, id, how);
        log.append(TENANT, List.of(new Transition(Transition.Kind.CLOSED, id, "1", SymptomState.ACTIVE, ASSET,
                how.at(), level, level, 0, how.context())), new TransitionLog.Place(TRIP, null, null, null, null));
    }

    @Test
    void aCaseClosedAfterACallDoesNotReopenAtTheSameLevel() {
        publish(LIFECYCLE);
        EvaluatorStream consumer = consumer();
        assertEquals(List.of("OPENED:1", "LEVEL_CHANGED:4"), drive(consumer, 0, 270.8, 360.5));

        operatorCloses(consumer, 10, 4, false);

        assertEquals(List.of(), drive(consumer, 20, 365.5, 370.5, 380.0),
                "production reopened 21 s and 42 s later at level 4");
    }

    @Test
    void aHandledCaseReopensOnlyAboveItsLevel() {
        publish(LIFECYCLE);
        EvaluatorStream consumer = consumer();
        assertEquals(List.of("OPENED:1", "LEVEL_CHANGED:2"), drive(consumer, 0, 280, 305));

        operatorCloses(consumer, 10, 2, false);

        assertEquals(List.of(), drive(consumer, 20, 310, 320, 290), "levels 2 and 1 stay closed");
        assertEquals(List.of("OPENED:3"), drive(consumer, 30, 335), "level 3 is above the closed case's 2");
        assertEquals(List.of("LEVEL_CHANGED:4"), drive(consumer, 40, 362));
    }

    @Test
    void anInvalidatedCaseDoesNotReopenAtAnyLevelWhileTheConditionHolds() {
        publish(LIFECYCLE);
        EvaluatorStream consumer = consumer();
        assertEquals(List.of("OPENED:1", "LEVEL_CHANGED:4"), drive(consumer, 0, 270.8, 360.5));
        operatorCloses(consumer, 10, 4, false);
        assertEquals(List.of(), drive(consumer, 20, 365.5));

        // A new episode opens a case, and the operator invalidates it ("Regla mal calibrada") at its level 1.
        assertEquals(List.of("OPENED:1"), drive(consumer, 30, 260, 275));
        operatorCloses(consumer, 40, 1, true);

        assertEquals(List.of(), drive(consumer, 50, 280, 310, 340, 370.5), "no level reopens it");
    }

    @Test
    void anInvalidatedCaseReopensOnceTheConditionClearsAndReturns() {
        publish(LIFECYCLE);
        EvaluatorStream consumer = consumer();
        drive(consumer, 0, 270.8, 360.5);
        operatorCloses(consumer, 10, 4, true);
        assertEquals(List.of(), drive(consumer, 20, 365.5, 370.5));

        assertEquals(List.of(), drive(consumer, 30, 200), "the driver rests: the condition goes normal");
        assertEquals(List.of("OPENED:1"), drive(consumer, 40, 271), "a new episode opens a case");
    }

    @Test
    void anOperatorCloseKeepsTheConditionTimers() {
        publish(new SymptomSpec("gps_signal", "signal.trip.active && " + MINUTES + " >= 270.0", null,
                Specs.levels(MINUTES + " < 300.0 && held_s >= 30", "false", "false", "false"), LIFECYCLE, null));
        EvaluatorStream consumer = consumer();
        assertEquals(List.of(), drive(consumer, 0, 280));
        assertEquals(List.of("OPENED:1"), drive(consumer, 30, 280));
        operatorCloses(consumer, 40, 1, true);
        assertEquals(List.of(), drive(consumer, 50, 280));
        assertEquals(List.of(), drive(consumer, 80, 280), "resetting held_s must not manufacture a normal episode");
    }

    @Test
    void recoveryDoesNotMistakeWaitingForAHoldTimeForANormalCondition() {
        publish(new SymptomSpec("gps_signal", "signal.trip.active && " + MINUTES + " >= 270.0", null,
                Specs.levels(MINUTES + " < 300.0 && held_s >= 30", "false", "false", "false"), LIFECYCLE, null));
        EvaluatorStream before = consumer();
        drive(before, 0, 280);
        drive(before, 30, 280);
        operatorCloses(before, 40, 1, true);
        EvaluatorStream after = consumer();
        assertEquals(List.of(), drive(after, 50, 280));
        assertEquals(List.of(), drive(after, 80, 280));
        assertEquals(List.of(), drive(after, 90, 200));
        assertEquals(List.of(), drive(after, 100, 280));
        assertEquals(List.of("OPENED:1"), drive(after, 130, 280));
    }

    @Test
    void closingAfterTheConditionAlreadyClearedDoesNotBlockTheNextEpisode() {
        publish(new SymptomSpec.Lifecycle("case.condition_s >= 0", "case.normal_s >= 120", true));
        EvaluatorStream consumer = consumer();
        drive(consumer, 0, 280);
        assertEquals(List.of(), drive(consumer, 10, 200));
        operatorCloses(consumer, 20, 1, true);
        assertEquals(List.of("OPENED:1"), drive(consumer, 30, 280));
    }

    @Test
    void aCaseTheEngineClosesReopensAsBefore() {
        publish(LIFECYCLE);
        EvaluatorStream consumer = consumer();
        assertEquals(List.of("OPENED:1", "LEVEL_CHANGED:4", "CLOSED:4"), drive(consumer, 0, 270.8, 360.5, 200));
        assertEquals(List.of("OPENED:1"), drive(consumer, 10, 275));
    }

    @Test
    void aRestartKeepsTheBlockFromTheClosedRow() {
        publish(LIFECYCLE);
        EvaluatorStream before = consumer();
        drive(before, 0, 270.8, 360.5);
        operatorCloses(before, 10, 4, true);

        EvaluatorStream after = consumer();
        assertEquals(List.of(), drive(after, 20, 365.5, 370.5), "no episode: the CLOSED row restores the block");
        assertEquals(List.of(), drive(after, 30, 200));
        assertEquals(List.of("OPENED:1"), drive(after, 40, 275));
    }

    @Test
    void aNormalFirstFrameAfterRestartEndsTheBlock() {
        publish(LIFECYCLE);
        EvaluatorStream before = consumer();
        drive(before, 0, 280);
        operatorCloses(before, 10, 1, true);

        EvaluatorStream after = consumer();
        assertEquals(List.of(), drive(after, 20, 200));
        assertEquals(List.of("OPENED:1"), drive(after, 30, 280));
    }

    @Test
    void aRuleErrorOnTheFirstRestartFrameDoesNotLoseSuppression() {
        publish(LIFECYCLE);
        EvaluatorStream before = consumer();
        drive(before, 0, 280);
        operatorCloses(before, 10, 1, true);
        EvaluatorStream after = consumer();
        after.evaluate(signal(20, 280, TRIP).replace("\"speed\":280.0", "\"missing_speed\":280.0"));
        assertEquals(List.of(), drive(after, 30, 280));
    }

    @Test
    void aHeldReopeningKeepsItsLevelAboveTheHandledClose() {
        publish(LIFECYCLE);
        boolean[] held = {false};
        EvaluatorStream consumer = consumer(new InMemoryEpisodeRepository(), (tenant, asset, definition, opened) -> held[0]);
        drive(consumer, 0, 280, 310);
        operatorCloses(consumer, 10, 2, false);
        held[0] = true;
        assertEquals(List.of("HELD:3"), drive(consumer, 20, 340));
        held[0] = false;
        assertEquals(List.of("OPENED:3"), drive(consumer, 30, 340));
    }

    @Test
    void aRestartKeepsAHandledCloseLevel() {
        publish(LIFECYCLE);
        EvaluatorStream before = consumer();
        drive(before, 0, 270.8, 305);
        operatorCloses(before, 10, 2, false);

        EvaluatorStream after = consumer();
        assertEquals(List.of(), drive(after, 20, 310, 320));
        assertEquals(List.of("OPENED:3"), drive(after, 30, 340), "above level 2 a case opens");
    }

    @Test
    void anotherTripOpensACaseAtOnce() {
        publish(LIFECYCLE);
        EvaluatorStream consumer = consumer();
        drive(consumer, 0, 270.8, 360.5);
        operatorCloses(consumer, 10, 4, true);

        assertEquals(List.of("OPENED:4"), drive(consumer, "T-2", 20, 365.5));
    }

    @Test
    void aNormalFrameOnAnotherTripDoesNotRestoreAnOldBlock() {
        publish(LIFECYCLE);
        EvaluatorStream consumer = consumer();
        drive(consumer, 0, 280);
        operatorCloses(consumer, 10, 1, true);
        assertEquals(List.of(), drive(consumer, "T-2", 20, 200));
        assertEquals(List.of("OPENED:1"), drive(consumer, 30, 280));
    }

    @Test
    void anOpenRuleOnClosedOnTripStillBlocksTheWholeTrip() {
        publish(new SymptomSpec.Lifecycle("case.condition_s >= 0 && !case.closed_on_trip", "case.normal_s >= 0",
                true));
        EvaluatorStream consumer = consumer();
        drive(consumer, 0, 270.8, 360.5);
        operatorCloses(consumer, 10, 4, false);

        assertEquals(List.of(), drive(consumer, 20, 200, 275, 365),
                "a new episode on the same trip stays closed by the rule");
        assertEquals(List.of("OPENED:4"), drive(consumer, "T-2", 30, 365), "another trip opens");
    }

    @Test
    @EnabledIfSystemProperty(named = "miot.symptoms.test.redis-url", matches = ".+")
    void replicasAndRestartsShareSuppressionUntilANormalFrame() {
        publish(LIFECYCLE);
        var vertx = Vertx.vertx();
        var client = Redis.createClient(vertx,
                new RedisOptions()
                        .setConnectionString(System.getProperty("miot.symptoms.test.redis-url")));
        var api = RedisAPI.api(client);
        var first = new RedisEpisodes(api, Duration.ofDays(7));
        var second = new RedisEpisodes(api, Duration.ofDays(7));
        try {
            EvaluatorStream one = consumer(first);
            drive(one, 0, 280);
            operatorCloses(one, 10, 1, true);
            EvaluatorStream two = consumer(second);
            assertEquals(List.of(), drive(two, 20, 310, 370));
            assertEquals(List.of(), drive(consumer(new RedisEpisodes(api, Duration.ofDays(7))), 30, 380));
            assertEquals(List.of(), drive(two, 40, 200));
            assertEquals(List.of("OPENED:1"), drive(one, 50, 280));
        } finally {
            first.forget(TENANT, ASSET, id);
            client.close();
            vertx.close().await().indefinitely();
        }
    }

    @Test
    void theBlockSurvivesTheRedisJsonAndIsLeftOutWhenNull() {
        Episode marker = new OperatorClose(TRIP, T0, 3, false).marker(UUID.randomUUID(), ASSET);
        assertEquals(marker, RedisEpisodes.read(RedisEpisodes.write(marker)));
        assertEquals(3, RedisEpisodes.read(RedisEpisodes.write(marker)).reopenAbove());
        Episode plain = Episode.closedOnTrip(UUID.randomUUID(), ASSET, TRIP, T0);
        assertEquals(false, RedisEpisodes.write(plain).contains("reopenAbove"));
    }
}

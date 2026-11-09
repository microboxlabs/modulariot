package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.StaleCase;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog;
import com.microboxlabs.miot.symptoms.lostsignal.PgTripEnds;
import com.microboxlabs.miot.symptoms.lostsignal.TripEnds;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.ArrayList;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * A trip's end against a real database: which trips ended, and closing their lost-signal cases. Skipped unless
 * {@code -Dmiot.symptoms.test.pg-url=...} is set; drops and re-creates {@code miot_symptoms} and {@code miot_trips}.
 */
@EnabledIfSystemProperty(named = PgTreatmentStoresTest.URL_PROPERTY, matches = ".+")
class PgTripEndTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final List<String> MIGRATIONS = List.of("V0.8.0__create_symptoms_catalog.sql",
            "V0.8.1__create_control_tower_treatments.sql", "V0.8.2__extend_contacts.sql",
            "V0.8.3__create_tower_settings.sql", "V0.8.4__create_signal_transitions.sql", "V0.8.5__signal_cases.sql",
            "V0.9.7__sla_expiry.sql", "V0.12.10__transition_context.sql", "V0.12.13__held_transitions.sql",
            "V0.12.24__trip_end_effects.sql");

    private static Vertx vertx;
    private static Pool pool;

    private final PgTransitionLog log = new PgTransitionLog(() -> pool);
    private final PgEngineCases cases = new PgEngineCases(() -> pool);
    private final PgTripEnds ends = new PgTripEnds(() -> pool, cases);
    private final Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    private final String tenant = "tenant-" + UUID.randomUUID();

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty(PgTreatmentStoresTest.URL_PROPERTY)))
                .using(vertx).build();
        pool.query("DROP SCHEMA IF EXISTS miot_symptoms CASCADE").execute().await().atMost(WAIT);
        pool.query("DROP SCHEMA IF EXISTS miot_trips CASCADE").execute().await().atMost(WAIT);
        pool.query("CREATE SCHEMA miot_trips").execute().await().atMost(WAIT);
        pool.query("""
                CREATE TABLE IF NOT EXISTS miot_trips.trip_live (
                    trip_id uuid PRIMARY KEY, tenant_code text NOT NULL, asset_id text, mandate_codes jsonb)
                """).execute().await().atMost(WAIT);
        pool.query("""
                CREATE TABLE IF NOT EXISTS miot_trips.trip (
                    id uuid PRIMARY KEY, tenant_code text NOT NULL, status text NOT NULL)
                """).execute().await().atMost(WAIT);
        pool.query("""
                CREATE TABLE IF NOT EXISTS miot_trips.trip_milestone (
                    trip_id uuid NOT NULL, tenant_code text NOT NULL, milestone text NOT NULL, status text NOT NULL)
                """).execute().await().atMost(WAIT);
        for (String file : MIGRATIONS) {
            try (InputStream in = PgTripEndTest.class.getResourceAsStream("/db/migration/symptoms/" + file)) {
                pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
            }
        }
    }

    @AfterAll
    static void close() {
        try {
            pool.query("DROP SCHEMA IF EXISTS miot_trips CASCADE").execute().await().atMost(WAIT);
        } finally {
            pool.close().await().atMost(WAIT);
            vertx.close().await().atMost(WAIT);
        }
    }

    private UUID trip(String status) {
        UUID id = UUID.randomUUID();
        PgIds.query(pool, "INSERT INTO miot_trips.trip (id, tenant_code, status) VALUES ($1, $2, $3)",
                Tuple.of(id, tenant, status));
        return id;
    }

    private UUID symptom(String key) {
        UUID id = UUID.randomUUID();
        PgIds.query(pool, """
                INSERT INTO miot_symptoms.symptom_definition
                    (id, tenant_code, symptom_key, name, source_key, state, current_version, created_by, updated_by)
                VALUES ($1, $2, $3, $3, 'trip_check', 'ACTIVE', '1.0.0', 't', 't')
                """, Tuple.of(id, tenant, key));
        return id;
    }

    private long open(UUID symptom, String asset, String tripId, int level) {
        long id = log.append(tenant, List.of(new Transition(Kind.OPENED, symptom, "1.0.0", SymptomState.ACTIVE,
                asset, now.minusSeconds(3600), 1, 0, 30)), new TransitionLog.Place(tripId, null, null, null, null))
                .get(0).caseId();
        if (level > 1) {
            log.append(tenant, List.of(new Transition(Kind.LEVEL_CHANGED, symptom, "1.0.0", SymptomState.ACTIVE,
                    asset, now.minusSeconds(600), level, 1, 30)),
                    new TransitionLog.Place(tripId, null, null, null, null));
        }
        return id;
    }

    @Test
    void completedCancelledAndMissingTripsEndedAndAnArrivalIsRead() {
        UUID running = trip("in_progress");
        PgIds.query(pool, "INSERT INTO miot_trips.trip_milestone VALUES ($1, $2, 'arrival', 'confirmed')",
                Tuple.of(running, tenant));
        Map<String, TripEnds.State> states = ends.states(Map.of(tenant, running.toString(),
                "other-a", trip("completed").toString()));
        assertEquals(new TripEnds.State(false, true), states.get(tenant));

        assertEquals(new TripEnds.State(true, false), ends.states(Map.of(tenant, trip("completed").toString()))
                .get(tenant));
        assertEquals(new TripEnds.State(true, false), ends.states(Map.of(tenant, trip("cancelled").toString()))
                .get(tenant));
        assertEquals(new TripEnds.State(true, false), ends.states(Map.of(tenant, UUID.randomUUID().toString()))
                .get(tenant), "no such trip");
        assertEquals(new TripEnds.State(true, false), ends.states(Map.of(tenant, "not-a-uuid")).get(tenant));
        assertEquals(new TripEnds.State(true, false), ends.states(Map.of(tenant, "1-1-1-1-1")).get(tenant));
    }

    @Test
    void aStateReadBeforeCompletionCannotOpenTheFirstCaseAfterTheEndNotice() {
        UUID id = trip("in_progress");
        UUID definition = symptom("opening-race");
        assertEquals(new TripEnds.State(false, false), ends.states(Map.of(tenant, id.toString())).get(tenant));
        PgIds.query(pool, "UPDATE miot_trips.trip SET status = 'completed' WHERE id = $1", Tuple.of(id));
        assertTrue(ends.close(tenant, id.toString(), List.of(definition), now).isEmpty());

        Transition opening = new Transition(Kind.OPENED, definition, "1.0.0", SymptomState.ACTIVE,
                "FIRST", now, 1, 0, 30);
        List<Transition> changes = List.of(opening);
        TransitionLog.Place place = new TransitionLog.Place(id.toString(), null, null, null, null);
        Map<String, Object> context = Map.of("check", Map.of("loss", Map.of("ratio", 1.0)));
        assertThrows(IllegalStateException.class, () -> log.appendTripCheck(tenant, changes, place, context));
        assertTrue(cases.open(tenant).isEmpty());
    }

    @Test
    void aFailedCloseObserverLeavesDurableEffectsForANewReplica() {
        ends.retry(ignored -> { });
        UUID definition = symptom("observer-retry");
        String tripId = trip("completed").toString();
        long caseId = open(definition, "RETRY", tripId, 2);
        SymptomEvents failing = new SymptomEvents(event -> CompletableFuture.failedFuture(
                new IllegalStateException("observer unavailable")));

        List<UUID> definitions = List.of(definition);
        Consumer<TripEnds.Closure> observer = c -> failing.closedBySystem(tenant, c.value(), TripEnds.REASON, c.at())
                .toCompletableFuture().join();
        assertThrows(RuntimeException.class, () -> ends.end(tenant, tripId, definitions, now, observer));
        assertNotNull(cases.find(tenant, caseId).orElseThrow().closedAt());
        List<TripEnds.Closure> delivered = new ArrayList<>();
        PgTripEnds replica = new PgTripEnds(() -> pool, cases);
        assertEquals(1, replica.retry(delivered::add));
        assertEquals(caseId, delivered.get(0).value().id());
        assertEquals(now, delivered.get(0).at());
        assertEquals(0, replica.retry(delivered::add));
        assertTrue(ends.close(tenant, tripId, List.of(definition), now).isEmpty());
    }

    @Test
    void aStateSweepAndTripClosureWriteOneClosedRow() throws Exception {
        UUID definition = symptom("state-race");
        String tripId = trip("completed").toString();
        open(definition, "STATE", tripId, 2);
        PgIds.query(pool, "UPDATE miot_symptoms.symptom_definition SET state = 'OFF' WHERE id = $1",
                Tuple.of(definition));
        try (var workers = Executors.newFixedThreadPool(2)) {
            Future<Integer> sweep = workers.submit(() -> cases.closeStale(tenant, definition, now, "state change").size());
            Future<Integer> end = workers.submit(() -> ends.close(tenant, tripId, List.of(definition), now).size());
            assertEquals(1, sweep.get(15, TimeUnit.SECONDS) + end.get(15, TimeUnit.SECONDS));
        }
    }

    @Test
    void tripClosureAndAnEvaluatorBatchUseTheSameLockOrder() throws Exception {
        List<UUID> definitions = java.util.stream.Stream.of(symptom("lock-a"), symptom("lock-b"))
                .sorted(java.util.Comparator.comparing(UUID::toString)).toList();
        UUID a = definitions.get(0);
        UUID b = definitions.get(1);
        String tripId = trip("in_progress").toString();
        long first = open(b, "LOCKS", tripId, 1);
        open(a, "LOCKS", tripId, 1);
        var blocker = pool.getConnection().await().atMost(WAIT);
        var transaction = blocker.begin().await().atMost(WAIT);
        var workers = Executors.newFixedThreadPool(2);
        try {
            blocker.preparedQuery("SELECT id FROM miot_symptoms.signal_transitions WHERE id = $1 FOR UPDATE")
                    .execute(Tuple.of(first)).await().atMost(WAIT);
            Future<Integer> end = workers.submit(() -> ends.close(tenant, tripId, definitions, now).size());
            awaitWaitingLocks(1);
            Future<Integer> batch = workers.submit(() -> log.appendTripCheck(tenant, List.of(
                    new Transition(Kind.LEVEL_CHANGED, a, "1.0.0", SymptomState.ACTIVE, "LOCKS", now, 2, 1, 30),
                    new Transition(Kind.LEVEL_CHANGED, b, "1.0.0", SymptomState.ACTIVE, "LOCKS", now, 2, 1, 30)),
                    new TransitionLog.Place(tripId, null, null, null, null), null).size());
            awaitWaitingLocks(2);
            transaction.commit().await().atMost(WAIT);
            assertEquals(2, end.get(15, TimeUnit.SECONDS));
            assertEquals(0, batch.get(15, TimeUnit.SECONDS));
        } finally {
            blocker.close().await().atMost(WAIT);
            workers.shutdownNow();
        }
    }

    private static void awaitWaitingLocks(int count) {
        org.awaitility.Awaitility.await().atMost(Duration.ofSeconds(5)).pollInterval(Duration.ofMillis(10)).until(() -> {
            Row row = pool.query("""
                    SELECT count(*) AS waiting FROM pg_stat_activity
                     WHERE datname = current_database() AND wait_event_type = 'Lock'
                    """).execute().await().atMost(WAIT).iterator().next();
            return row.getLong("waiting") >= count;
        });
    }

    @Test
    void concurrentReplicasAndAnOperatorCloseTheCaseOnce() throws Exception {
        UUID lost = symptom("concurrent-loss");
        String tripId = UUID.randomUUID().toString();
        long caseId = open(lost, "RACE", tripId, 2);

        try (var workers = Executors.newFixedThreadPool(3)) {
            Future<Integer> first = workers.submit(() -> ends.close(tenant, tripId, List.of(lost), now).size());
            Future<Integer> second = workers.submit(() -> ends.close(tenant, tripId, List.of(lost), now).size());
            Future<Integer> operator = workers.submit(() -> cases.close(tenant, caseId, "ops@example.com", now) ? 1 : 0);
            assertEquals(1, first.get() + second.get() + operator.get());
        }

        Row row = PgIds.query(pool, """
                SELECT count(*) AS closes FROM miot_symptoms.signal_transitions
                 WHERE tenant_code = $1 AND definition_id = $2 AND asset_id = 'RACE' AND kind = 'CLOSED'
                """, Tuple.of(tenant, lost)).iterator().next();
        assertEquals(1L, row.getLong("closes"));
    }

    @Test
    void closesTheTripsOpenCasesAtTheirLevelOnce() {
        UUID lost = symptom("signal-loss");
        UUID other = symptom("other");
        String tripId = UUID.randomUUID().toString();
        long high = open(lost, "TRUCK1", tripId, 4);
        long kept = open(other, "TRUCK1", tripId, 1);
        long otherTrip = open(lost, "TRUCK2", UUID.randomUUID().toString(), 2);

        List<StaleCase> closed = ends.close(tenant, tripId, List.of(lost), now);

        assertEquals(1, closed.size());
        assertEquals(high, closed.get(0).id());
        assertEquals(4, closed.get(0).level());
        Row row = PgIds.query(pool, """
                SELECT closed_by, context ->> 'reason' AS reason, level FROM miot_symptoms.signal_transitions
                 WHERE tenant_code = $1 AND kind = 'CLOSED' AND definition_id = $2 AND asset_id = 'TRUCK1'
                """, Tuple.of(tenant, lost)).iterator().next();
        assertEquals(TripEnds.REASON, row.getString("closed_by"));
        assertEquals(TripEnds.REASON, row.getString("reason"));
        assertEquals(4, row.getInteger("level"));
        assertNull(cases.find(tenant, kept).orElseThrow().closedAt(), "another symptom stays open");
        assertNull(cases.find(tenant, otherTrip).orElseThrow().closedAt(), "another trip stays open");
        assertTrue(ends.close(tenant, tripId, List.of(lost), now).isEmpty(), "closed once");
    }

    @Test
    void tripEndUsesTheEpisodeMaximumAndContextEvenWithoutALevelChange() {
        UUID lost = symptom("signal-loss");
        String tripId = UUID.randomUUID().toString();
        Instant opened = now.minusSeconds(3600).plusNanos(123456789);
        log.append(tenant, List.of(new Transition(Kind.OPENED, lost, "1.0.0", SymptomState.ACTIVE,
                "vehicle-demo", opened, 1, 0, 30)), new TransitionLog.Place(tripId, null, null, null, null),
                Map.of("check", Map.of("signal_lost_minutes", 30.0)));
        var episodes = new com.microboxlabs.miot.symptoms.evaluator.InMemoryEpisodeRepository();
        var state = episodes.load(tenant, "vehicle-demo");
        state.save(tenant, new com.microboxlabs.miot.symptoms.evaluator.Episode(lost, "1.0.0", "vehicle-demo",
                opened, opened, null, Map.of(), now.minusSeconds(60), opened, 1, 125, SymptomState.ACTIVE,
                null, null, null, tripId, Map.of("check", Map.of("signal_lost_minutes", 110.0))));
        episodes.save(state);
        assertEquals(1, ends.withEpisodes(episodes).close(tenant, tripId, List.of(lost), now).size());

        Row row = PgIds.query(pool, """
                SELECT measure, (context -> 'check' ->> 'signal_lost_minutes')::float AS lost,
                       context ->> 'reason' AS reason FROM miot_symptoms.signal_transitions
                 WHERE tenant_code = $1 AND definition_id = $2 AND kind = 'CLOSED'
                """, Tuple.of(tenant, lost)).iterator().next();
        assertEquals(125.0, row.getDouble("measure"));
        assertEquals(110.0, row.getDouble("lost"));
        assertEquals(TripEnds.REASON, row.getString("reason"));
    }

    @Test
    void tripEndFallbackKeepsIntermediatePeaksAndLatestNonNullContext() {
        UUID lost = symptom("signal-loss");
        String tripId = UUID.randomUUID().toString();
        TransitionLog.Place place = new TransitionLog.Place(tripId, null, null, null, null);
        log.append(tenant, List.of(new Transition(Kind.OPENED, lost, "1.0.0", SymptomState.ACTIVE,
                "vehicle-demo", now.minusSeconds(3600), 1, 0, 30)), place,
                Map.of("check", Map.of("signal_lost_minutes", 30.0)));
        log.append(tenant, List.of(new Transition(Kind.LEVEL_CHANGED, lost, "1.0.0", SymptomState.ACTIVE,
                "vehicle-demo", now.minusSeconds(600), 3, 1, 120)), place,
                Map.of("check", Map.of("signal_lost_minutes", 120.0)));
        log.append(tenant, List.of(new Transition(Kind.LEVEL_CHANGED, lost, "1.0.0", SymptomState.ACTIVE,
                "vehicle-demo", now.minusSeconds(300), 2, 3, 60)), place, null);
        assertEquals(1, ends.close(tenant, tripId, List.of(lost), now).size());

        Row row = PgIds.query(pool, """
                SELECT measure, level, (context -> 'check' ->> 'signal_lost_minutes')::float AS lost
                  FROM miot_symptoms.signal_transitions
                 WHERE tenant_code = $1 AND definition_id = $2 AND kind = 'CLOSED'
                """, Tuple.of(tenant, lost)).iterator().next();
        assertEquals(120.0, row.getDouble("measure"));
        assertEquals(2, row.getInteger("level"));
        assertEquals(120.0, row.getDouble("lost"));
    }

    @Test
    void legacyRecoveryUsesTheLatestNonNullContextWithinItsOwnCase() {
        UUID lost = symptom("signal-loss");
        String tripId = UUID.randomUUID().toString();
        String asset = "vehicle-demo";
        Instant opened = now.minusSeconds(3600).plusNanos(123456789);
        TransitionLog.Place place = new TransitionLog.Place(tripId, null, null, null, null);
        log.append(tenant, List.of(new Transition(Kind.OPENED, lost, "1.0.0", SymptomState.ACTIVE,
                asset, opened, 1, 0, 30)), place, Map.of("check", Map.of("signal_lost_minutes", 30.0)));
        Map<String, Object> latest = Map.of("check", Map.of("signal_lost_minutes", 120.0,
                "geo", Map.of("zone", "Synthetic zone")));
        log.append(tenant, List.of(new Transition(Kind.LEVEL_CHANGED, lost, "1.0.0", SymptomState.ACTIVE,
                asset, now.minusSeconds(600), 3, 1, 120)), place, latest);
        log.append(tenant, List.of(new Transition(Kind.LEVEL_CHANGED, lost, "1.0.0", SymptomState.ACTIVE,
                asset, now.minusSeconds(300), 2, 3, 60)), place, null);
        var legacy = new com.microboxlabs.miot.symptoms.evaluator.Episode(lost, "1.0.0", asset,
                opened, opened, null, Map.of(), now.minusSeconds(300), opened, 2, 120, SymptomState.ACTIVE);
        assertEquals(new TransitionLog.Opening(tripId, latest), log.opening(tenant, legacy));
        ends.close(tenant, tripId, List.of(lost), now);
        log.append(tenant, List.of(new Transition(Kind.OPENED, lost, "1.0.0", SymptomState.ACTIVE,
                asset, now.plusSeconds(60), 1, 0, 300)), place, Map.of("check", Map.of("signal_lost_minutes", 300.0)));
        log.append(tenant, List.of(new Transition(Kind.LEVEL_CHANGED, lost, "1.0.0", SymptomState.ACTIVE,
                asset, now.plusSeconds(120), 2, 1, 400)), place, Map.of("check", Map.of("signal_lost_minutes", 400.0)));
        assertEquals(new TransitionLog.Opening(tripId, latest), log.opening(tenant, legacy),
                "a newer case cannot supply the legacy case's evidence");
    }

    @Test
    void aTripEndCloseKeepsTheTripTheMeasureAndTheLastContext() {
        UUID lost = symptom("signal-loss");
        String tripId = UUID.randomUUID().toString();
        TransitionLog.Place place = new TransitionLog.Place(tripId, null, null, null, null);
        log.append(tenant, List.of(new Transition(Kind.OPENED, lost, "1.0.0", SymptomState.ACTIVE,
                "TRUCK3", now.minusSeconds(3600), 1, 0, 30)), place,
                Map.of("check", Map.of("signal_lost_minutes", 30.0)));
        log.append(tenant, List.of(new Transition(Kind.LEVEL_CHANGED, lost, "1.0.0", SymptomState.ACTIVE,
                "TRUCK3", now.minusSeconds(600), 2, 1, 95)), place,
                Map.of("check", Map.of("signal_lost_minutes", 95.0)));

        assertEquals(1, ends.close(tenant, tripId, List.of(lost), now).size());

        Row row = PgIds.query(pool, """
                SELECT trip_id, measure, context ? 'closed_reason' AS has_closed_reason,
                       context ->> 'reason' AS reason, (context -> 'check' ->> 'signal_lost_minutes')::float AS lost
                  FROM miot_symptoms.signal_transitions
                 WHERE tenant_code = $1 AND kind = 'CLOSED' AND definition_id = $2 AND asset_id = 'TRUCK3'
                """, Tuple.of(tenant, lost)).iterator().next();
        assertEquals(tripId, row.getString("trip_id"));
        assertEquals(95.0, row.getDouble("measure"));
        assertEquals(false, row.getBoolean("has_closed_reason"));
        assertEquals(TripEnds.REASON, row.getString("reason"));
        assertEquals(95.0, row.getDouble("lost"));
    }
}

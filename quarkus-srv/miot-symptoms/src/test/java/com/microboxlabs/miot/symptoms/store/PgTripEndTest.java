package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.StaleCase;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog;
import com.microboxlabs.miot.symptoms.lostsignal.PgTripEnds;
import com.microboxlabs.miot.symptoms.lostsignal.TripEnds;
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
            "V0.9.7__sla_expiry.sql", "V0.12.10__transition_context.sql", "V0.12.13__held_transitions.sql");

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
}

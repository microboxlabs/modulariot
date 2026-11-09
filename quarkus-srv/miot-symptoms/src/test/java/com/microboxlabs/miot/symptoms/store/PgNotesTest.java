package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Notes against a scratch PostgreSQL database; no containers. Recreates the symptoms schema. */
@EnabledIfSystemProperty(named = "miot.symptoms.test.pg-url", matches = ".+")
class PgNotesTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final TransitionLog.Place NOWHERE = new TransitionLog.Place(null, null, null, null, null);
    private static Vertx vertx;
    private static Pool pool;

    private final UUID definition = UUID.randomUUID();
    private final String tenant = "tenant-" + UUID.randomUUID();
    private final Instant at = Instant.parse("2026-01-01T12:00:00Z");
    private final PgTransitionLog log = new PgTransitionLog(() -> pool);
    private final PgEngineCases cases = new PgEngineCases(() -> pool);

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.symptoms.test.pg-url")))
                .using(vertx).build();
        pool.query("DROP SCHEMA IF EXISTS miot_symptoms CASCADE").execute().await().atMost(WAIT);
        pool.query("CREATE SCHEMA miot_symptoms").execute().await().atMost(WAIT);
        for (String file : List.of("V0.8.0__create_symptoms_catalog.sql", "V0.8.4__create_signal_transitions.sql", "V0.8.5__signal_cases.sql",
                "V0.12.10__transition_context.sql", "V0.12.15__noted_transitions.sql",
                "V0.12.26__transition_operator.sql")) {
            try (InputStream in = PgNotesTest.class.getResourceAsStream("/db/migration/symptoms/" + file)) {
                pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
            }
        }
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    private Transition transition(Kind kind, int seconds) {
        return new Transition(kind, definition, "1.0.0", SymptomState.ACTIVE, "DEMO01", at.plusSeconds(seconds),
                1, 1, 0, kind == Kind.NOTED ? Map.of("note", Map.of("event_type", "test_event")) : null);
    }

    @Test
    void concurrentDeliveriesWriteOneNotePerFrame() {
        long caseId = log.append(tenant, List.of(transition(Kind.OPENED, 0)), NOWHERE).getFirst().caseId();
        List<CompletableFuture<Integer>> attempts = IntStream.range(0, 8)
                .mapToObj(i -> CompletableFuture.supplyAsync(() ->
                        log.append(tenant, List.of(transition(Kind.NOTED, 60)), NOWHERE).size())).toList();

        assertEquals(1, attempts.stream().mapToInt(CompletableFuture::join).sum());
        assertEquals(1, cases.notes(tenant, caseId).size());
    }

    @Test
    void notesCoexistWithLevelChangesAndBelongToTheirCase() {
        long first = log.append(tenant, List.of(transition(Kind.OPENED, 0)), NOWHERE).getFirst().caseId();
        List<Transition> frame = List.of(transition(Kind.LEVEL_CHANGED, 60), transition(Kind.NOTED, 60));
        assertEquals(2, log.append(tenant, frame, NOWHERE).size());
        assertEquals(0, log.append(tenant, frame, NOWHERE).size());
        log.append(tenant, List.of(transition(Kind.CLOSED, 120)), NOWHERE);
        long second = log.append(tenant, List.of(transition(Kind.OPENED, 180)), NOWHERE).getFirst().caseId();
        log.append(tenant, List.of(transition(Kind.NOTED, 240)), NOWHERE);

        assertEquals(List.of(at.plusSeconds(60)), cases.notes(tenant, first).stream().map(n -> n.recordedAt()).toList());
        assertEquals(List.of(at.plusSeconds(240)), cases.notes(tenant, second).stream().map(n -> n.recordedAt()).toList());
    }

    @Test
    void lateNotesAreReadInEventTimeOrder() {
        long caseId = log.append(tenant, List.of(transition(Kind.OPENED, 0)), NOWHERE).getFirst().caseId();
        log.append(tenant, List.of(transition(Kind.NOTED, 60)), NOWHERE);
        log.append(tenant, List.of(transition(Kind.NOTED, 30)), NOWHERE);

        assertEquals(List.of(at.plusSeconds(30), at.plusSeconds(60)),
                cases.notes(tenant, caseId).stream().map(n -> n.at()).toList());
    }
}

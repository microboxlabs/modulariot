package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
import com.microboxlabs.miot.symptoms.cases.SlaStore;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The transition log's case ids and the SLA timer's reads against a real database. Skipped unless
 * {@code -Dmiot.symptoms.test.pg-url=...} is set, as {@link PgTreatmentStoresTest}; the {@code miot_symptoms}
 * schema is dropped and re-created, so use a scratch database.
 */
@EnabledIfSystemProperty(named = PgTreatmentStoresTest.URL_PROPERTY, matches = ".+")
class PgSlaStoreTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final List<String> MIGRATIONS = List.of("V0.8.0__create_symptoms_catalog.sql",
            "V0.8.1__create_control_tower_treatments.sql", "V0.8.2__extend_contacts.sql",
            "V0.8.3__create_tower_settings.sql", "V0.8.4__create_signal_transitions.sql", "V0.8.5__signal_cases.sql",
            "V0.9.7__sla_expiry.sql");
    private static final String SPEC = """
            {"levels":[{"icu":1,"applies":true,"when":"true","response":{"operator":false}},
                       {"icu":3,"applies":true,"when":"true","response":{"operator":true,"slaMinutes":15}}]}
            """;

    private static Vertx vertx;
    private static Pool pool;

    private final PgTransitionLog log = new PgTransitionLog(() -> pool);
    private final PgSlaStore sla = new PgSlaStore(() -> pool);

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty(PgTreatmentStoresTest.URL_PROPERTY)))
                .using(vertx).build();
        pool.query("DROP SCHEMA IF EXISTS miot_symptoms CASCADE").execute().await().atMost(WAIT);
        for (String file : MIGRATIONS) {
            try (InputStream in = PgSlaStoreTest.class.getResourceAsStream("/db/migration/symptoms/" + file)) {
                pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
            }
        }
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    private static UUID symptom(String tenant) {
        UUID id = UUID.randomUUID();
        PgIds.query(pool, """
                INSERT INTO miot_symptoms.symptom_definition
                    (id, tenant_code, symptom_key, name, source_key, state, current_version, created_by, updated_by)
                VALUES ($1, $2, 'speeding', 'Exceso de velocidad', 'gps_signal', 'ACTIVE', '1.0.0', 't', 't')
                """, Tuple.of(id, tenant));
        PgIds.query(pool, """
                INSERT INTO miot_symptoms.symptom_version
                    (definition_id, tenant_code, version, status, spec, created_by)
                VALUES ($1, $2, '1.0.0', 'PUBLISHED', $3::text::jsonb, 't')
                """, Tuple.of(id, tenant, SPEC));
        return id;
    }

    private static Transition t(Kind kind, UUID definition, Instant at, int level, int previous) {
        return new Transition(kind, definition, "1.0.0", SymptomState.ACTIVE, "DEMO01", at, level, previous, 30);
    }

    @Test
    void theLogReturnsNewChangesWithTheirCaseAndSkipsReplays() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        Instant t0 = Instant.parse("2026-10-22T03:00:00Z");
        TransitionLog.Place place = new TransitionLog.Place("T-1", -33.4, -70.6, 95.0, null);

        List<TransitionLog.Recorded> opened = log.append(tenant, List.of(t(Kind.OPENED, speeding, t0, 1, 0)), place);
        List<TransitionLog.Recorded> rose = log.append(tenant,
                List.of(t(Kind.LEVEL_CHANGED, speeding, t0.plusSeconds(30), 3, 1)), place);
        List<TransitionLog.Recorded> replay = log.append(tenant,
                List.of(t(Kind.LEVEL_CHANGED, speeding, t0.plusSeconds(30), 3, 1)), place);

        assertEquals(1, opened.size());
        assertEquals(opened.get(0).caseId(), rose.get(0).caseId());
        assertTrue(replay.isEmpty());
    }

    @Test
    void aFailedChangeLeavesNoneOfItsBatchSoTheReplayRecordsThemAll() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        UUID other = UUID.randomUUID();
        Instant t0 = Instant.parse("2026-10-22T03:00:00Z");
        TransitionLog.Place place = new TransitionLog.Place("T-1", -33.4, -70.6, 95.0, null);
        Transition first = t(Kind.OPENED, speeding, t0, 1, 0);
        Transition tooLong = new Transition(Kind.OPENED, other, "1.0.0-" + "x".repeat(40), SymptomState.ACTIVE,
                "DEMO01", t0, 1, 0, 30);

        List<Transition> batch = List.of(first, tooLong);
        assertThrows(RuntimeException.class, () -> log.append(tenant, batch, place));

        List<TransitionLog.Recorded> replay = log.append(tenant, List.of(first, t(Kind.OPENED, other, t0, 1, 0)),
                place);
        assertEquals(2, replay.size());
    }

    @Test
    void overlappingOperatorClosesWriteOneClose() throws Exception {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        Instant t0 = Instant.parse("2026-10-22T03:00:00Z");
        long caseId = log.append(tenant, List.of(t(Kind.OPENED, speeding, t0, 3, 0)),
                new TransitionLog.Place(null, null, null, null, null)).get(0).caseId();
        PgEngineCases cases = new PgEngineCases(() -> pool);

        CompletableFuture<Boolean> a = CompletableFuture.supplyAsync(
                () -> cases.close(tenant, caseId, "first@example.com", t0.plusSeconds(60)));
        CompletableFuture<Boolean> b = CompletableFuture.supplyAsync(
                () -> cases.close(tenant, caseId, "second@example.com", t0.plusSeconds(61)));

        assertTrue(a.get() ^ b.get(), "exactly one close wrote");
        assertFalse(cases.close(tenant, caseId, "third@example.com", t0.plusSeconds(62)));
        assertEquals(1L, PgIds.query(pool, """
                SELECT count(*) AS n FROM miot_symptoms.signal_transitions WHERE tenant_code = $1 AND kind = 'CLOSED'
                """, Tuple.of(tenant)).iterator().next().getLong("n"));
    }

    @Test
    void casesAreFoundByTripVehicleNameLevelAndActiveTime() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        Instant t0 = Instant.parse("2026-10-22T03:00:00Z");
        TransitionLog.Place trip = new TransitionLog.Place("T-1", -33.4, -70.6, 95.0, null);
        long first = log.append(tenant, List.of(t(Kind.OPENED, speeding, t0, 3, 0)), trip).get(0).caseId();
        PgEngineCases cases = new PgEngineCases(() -> pool);
        cases.close(tenant, first, "ops@example.com", t0.plusSeconds(60));
        long second = log.append(tenant, List.of(t(Kind.OPENED, speeding, t0.plusSeconds(120), 1, 0)), trip)
                .get(0).caseId();

        assertEquals(List.of(second), ids(cases.list(tenant, new EngineCaseStore.CaseFilter("T-1", null, null,
                null, null, null))), "without dates, the open one");
        Instant to = t0.plusSeconds(3600);
        assertEquals(List.of(second, first), ids(cases.list(tenant, new EngineCaseStore.CaseFilter("T-1", "demo",
                "exceso de VELOCIDAD", null, t0, to))));
        assertEquals(List.of(first), ids(cases.list(tenant, new EngineCaseStore.CaseFilter(null, null, null, 3, t0,
                to))), "by current level");
        assertEquals(t0.plusSeconds(60), cases.list(tenant, new EngineCaseStore.CaseFilter(null, null, null, 3, t0,
                to)).get(0).closedAt());
        assertTrue(cases.list(tenant, new EngineCaseStore.CaseFilter("T-2", null, null, null, t0, to)).isEmpty());
        assertEquals(List.of(second), ids(cases.list(tenant,
                new EngineCaseStore.CaseFilter(null, null, null, null, t0.plusSeconds(121), to))),
                "the case opened before the range remains active in it");
        assertEquals(List.of(first), ids(cases.list(tenant,
                new EngineCaseStore.CaseFilter(null, null, null, 3, t0.plusSeconds(60), to))),
                "closing exactly at the inclusive start is included");
        assertTrue(cases.list(tenant, new EngineCaseStore.CaseFilter(null, null, null, null,
                t0.plusSeconds(61), t0.plusSeconds(120))).isEmpty(),
                "exclude cases closed before the start or opened at the exclusive end");
        assertTrue(cases.list("other-" + tenant,
                new EngineCaseStore.CaseFilter(null, null, null, null, t0, to)).isEmpty(),
                "history stays within the tenant");
    }

    private static List<Long> ids(List<com.microboxlabs.miot.symptoms.cases.EngineCase> found) {
        return found.stream().map(com.microboxlabs.miot.symptoms.cases.EngineCase::id).toList();
    }

    @Test
    void anUnattendedCaseIsDueOnceAtItsLevelUntilATreatmentAttendsIt() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        Instant t0 = Instant.parse("2026-10-22T03:00:00Z");
        TransitionLog.Place place = new TransitionLog.Place("T-1", -33.4, -70.6, 95.0, null);
        long caseId = log.append(tenant, List.of(t(Kind.OPENED, speeding, t0, 1, 0)), place).get(0).caseId();
        Instant after = t0.minusSeconds(3600);

        assertTrue(due(after, t0.plusSeconds(3600), tenant).isEmpty(), "level 1 has no SLA");

        log.append(tenant, List.of(t(Kind.LEVEL_CHANGED, speeding, t0.plusSeconds(60), 3, 1)), place);
        assertTrue(due(after, t0.plusSeconds(60 + 14 * 60), tenant).isEmpty(), "within the SLA");
        List<SlaStore.Due> due = due(after, t0.plusSeconds(60 + 15 * 60), tenant);
        assertEquals(1, due.size());
        assertEquals(caseId, due.get(0).engineCase().id());
        assertEquals(3, due.get(0).engineCase().level());
        assertEquals(15, due.get(0).slaMinutes());
        assertEquals(t0.plusSeconds(60), due.get(0).levelSince());

        assertTrue(sla.markExpired(tenant, caseId, 3, 15, t0.plusSeconds(2000)));
        assertFalse(sla.markExpired(tenant, caseId, 3, 15, t0.plusSeconds(2001)));
        assertTrue(due(after, t0.plusSeconds(3600), tenant).isEmpty(), "expired once");
    }

    @Test
    void anOpenTreatmentAttendsTheCase() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        Instant t0 = Instant.parse("2026-10-22T03:00:00Z");
        long caseId = log.append(tenant, List.of(t(Kind.OPENED, speeding, t0, 3, 0)),
                new TransitionLog.Place(null, null, null, null, null)).get(0).caseId();
        PgIds.query(pool, """
                INSERT INTO miot_symptoms.treatment (tenant_code, symptom_id, type, opened_by, opened_at)
                VALUES ($1, $2, 'CALL', 'ops@example.com', $3)
                """, Tuple.of(tenant, -caseId, t0.minusSeconds(60).atOffset(ZoneOffset.UTC)));

        assertTrue(due(t0.minusSeconds(3600), t0.plusSeconds(3600), tenant).isEmpty());
    }

    private List<SlaStore.Due> due(Instant openedAfter, Instant now, String tenant) {
        return sla.due(openedAfter, now, 100).stream().filter(d -> d.tenantCode().equals(tenant)).toList();
    }
}

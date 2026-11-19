package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.PgTx;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.CaseFilter;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.OperatorScope;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
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
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The Control Tower's cached case reads against a real database: a write through the modulith's stores drops its
 * organization's entries. Skipped unless {@code -Dmiot.symptoms.test.pg-url=...} is set; drops and re-creates
 * {@code miot_symptoms}.
 */
@EnabledIfSystemProperty(named = PgTreatmentStoresTest.URL_PROPERTY, matches = ".+")
class PgCaseReadCacheTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final List<String> MIGRATIONS = List.of("V0.8.0__create_symptoms_catalog.sql",
            "V0.8.1__create_control_tower_treatments.sql", "V0.8.2__extend_contacts.sql",
            "V0.8.3__create_tower_settings.sql", "V0.8.4__create_signal_transitions.sql", "V0.8.5__signal_cases.sql",
            "V0.9.7__sla_expiry.sql", "V0.12.10__transition_context.sql", "V0.12.13__held_transitions.sql",
            "V0.12.26__after_trip_end_policy.sql", "V0.12.27__transition_operator.sql");
    private static final String SPEC = """
            {"levels":[{"icu":1,"applies":true,"when":"true","response":{"operator":true}},
                       {"icu":3,"applies":true,"when":"true","response":{"operator":true}}]}
            """;
    private static final TransitionLog.Place NOWHERE = new TransitionLog.Place(null, null, null, null, null);

    private static Vertx vertx;
    private static Pool pool;

    private final AtomicInteger queries = new AtomicInteger();
    private final CaseReadCache cache = new CaseReadCache(Duration.ofMinutes(5), null);
    private final PgEngineCases cases = new PgEngineCases(() -> {
        queries.incrementAndGet();
        return pool;
    }, cache);
    private final PgTransitionLog log = new PgTransitionLog(() -> pool, cache);
    private final PgTreatmentStore treatments = new PgTreatmentStore(() -> pool, cache);
    private final Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    private final String tenantA = "tenant-" + UUID.randomUUID();
    private final String tenantB = "tenant-" + UUID.randomUUID();

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty(PgTreatmentStoresTest.URL_PROPERTY)))
                .using(vertx).build();
        pool.query("DROP SCHEMA IF EXISTS miot_symptoms CASCADE").execute().await().atMost(WAIT);
        pool.query("CREATE SCHEMA IF NOT EXISTS miot_trips").execute().await().atMost(WAIT);
        pool.query("""
                CREATE TABLE IF NOT EXISTS miot_trips.trip_live (
                    trip_id uuid PRIMARY KEY, tenant_code text NOT NULL, asset_id text, mandate_codes jsonb)
                """).execute().await().atMost(WAIT);
        for (String file : MIGRATIONS) {
            try (InputStream in = PgCaseReadCacheTest.class.getResourceAsStream("/db/migration/symptoms/" + file)) {
                pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
            }
        }
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    private UUID symptom(String tenant) {
        UUID id = UUID.randomUUID();
        PgIds.query(pool, """
                INSERT INTO miot_symptoms.symptom_definition
                    (id, tenant_code, symptom_key, name, source_key, state, current_version, created_by, updated_by)
                VALUES ($1, $2, 'speeding', 'speeding', 'gps_signal', 'ACTIVE', '1.0.0', 't', 't')
                """, Tuple.of(id, tenant));
        PgIds.query(pool, """
                INSERT INTO miot_symptoms.symptom_version
                    (definition_id, tenant_code, version, status, spec, created_by)
                VALUES ($1, $2, '1.0.0', 'PUBLISHED', $3::text::jsonb, 't')
                """, Tuple.of(id, tenant, SPEC));
        return id;
    }

    private long open(String tenant, UUID symptom, String asset, int level) {
        return log.append(tenant, List.of(new Transition(Kind.OPENED, symptom, "1.0.0", SymptomState.ACTIVE, asset,
                now.minusSeconds(60), level, 0, 30)), NOWHERE).get(0).caseId();
    }

    private long inbox(String tenant) {
        return cases.towerCounts(tenant, OperatorScope.REQUIRED).active().stream()
                .mapToLong(EngineCaseStore.OpenCount::count).sum();
    }

    @Test
    void twoReadsWithinTheTtlRunOneQuery() {
        open(tenantA, symptom(tenantA), "TRUCK-1", 1);

        assertEquals(1, inbox(tenantA));
        assertEquals(1, inbox(tenantA));
        assertEquals(1, cases.openLevels(tenantA).size());
        assertEquals(1, cases.openLevels(tenantA).size());
        assertEquals(2, queries.get());
    }

    @Test
    void aCaseTransitionDropsOnlyItsOrganizationsEntries() {
        UUID a = symptom(tenantA);
        open(tenantA, a, "TRUCK-1", 1);
        open(tenantB, symptom(tenantB), "TRUCK-9", 1);
        assertEquals(1, inbox(tenantA));
        assertEquals(1, inbox(tenantB));
        int before = queries.get();

        open(tenantA, a, "TRUCK-2", 3);

        assertEquals(2, inbox(tenantA), "tenant A reads the new case at once");
        assertEquals(1, inbox(tenantB));
        assertEquals(before + 1, queries.get(), "tenant B kept its entry");
    }

    @Test
    void aTreatmentOpenAndCloseShowAtOnce() {
        long caseId = open(tenantA, symptom(tenantA), "TRUCK-1", 3);
        open(tenantB, symptom(tenantB), "TRUCK-9", 1);
        assertTrue(cases.towerCounts(tenantA, OperatorScope.REQUIRED).active().stream()
                .noneMatch(EngineCaseStore.OpenCount::underTreatment));
        inbox(tenantB);
        int before = queries.get();

        Treatment t = treatments.insert(new Treatment(null, tenantA, -caseId, "TRUCK-1", null, TreatmentType.CALL,
                TreatmentStatus.OPEN, "ops@example.com", now.atOffset(ZoneOffset.UTC), null, null, null, null,
                null)).treatment();

        assertTrue(cases.towerCounts(tenantA, OperatorScope.REQUIRED).active().stream()
                .allMatch(EngineCaseStore.OpenCount::underTreatment), "the open treatment shows at once");
        inbox(tenantB);
        assertEquals(before + 1, queries.get(), "tenant B kept its entry");

        treatments.transition(tenantA, t.id(), TreatmentStatus.CLOSED, "ops@example.com", "handled", null,
                now.atOffset(ZoneOffset.UTC));

        assertTrue(cases.towerCounts(tenantA, OperatorScope.REQUIRED).active().stream()
                .noneMatch(EngineCaseStore.OpenCount::underTreatment), "the close shows at once");
    }

    @Test
    void anOperatorCloseShowsAtOnce() {
        long caseId = open(tenantA, symptom(tenantA), "TRUCK-1", 3);
        assertEquals(1, inbox(tenantA));

        assertTrue(cases.close(tenantA, caseId, "ops@example.com", now));

        assertEquals(0, inbox(tenantA));
        assertTrue(cases.openLevels(tenantA).isEmpty());
    }

    @Test
    void filtersPagesAndTenantsKeepSeparateEntries() {
        UUID a = symptom(tenantA);
        long first = open(tenantA, a, "TRUCK-1", 1);
        long second = open(tenantA, a, "TRUCK-2", 3);
        long other = open(tenantB, symptom(tenantB), "TRUCK-9", 1);
        CaseFilter truck = new CaseFilter(null, "TRUCK-1", null, null, null, null);

        assertEquals(List.of(first), cases.list(tenantA, truck).stream().map(EngineCase::id).toList());
        assertEquals(2, cases.list(tenantA, CaseFilter.OPEN).size());
        assertEquals(List.of(other), cases.list(tenantB, CaseFilter.OPEN).stream().map(EngineCase::id).toList());
        assertEquals(1, cases.matchingCounts(tenantA, truck).stream().mapToLong(EngineCaseStore.OpenCount::count).sum());
        assertEquals(2, cases.matchingCounts(tenantA, CaseFilter.OPEN).stream()
                .mapToLong(EngineCaseStore.OpenCount::count).sum());
        assertEquals(List.of(second), cases.page(tenantA, CaseFilter.OPEN, 1, 1).cases().stream()
                .map(EngineCase::id).toList());
        assertEquals(List.of(first), cases.page(tenantA, CaseFilter.OPEN, 2, 1).cases().stream()
                .map(EngineCase::id).toList());
        assertEquals(2, cases.page(tenantA, CaseFilter.OPEN, 1, 2).cases().size());
        assertTrue(cases.towerCounts(tenantA, OperatorScope.NONE).active().isEmpty());
        assertEquals(2, cases.towerCounts(tenantA, OperatorScope.ALL).active().stream()
                .mapToLong(EngineCaseStore.OpenCount::count).sum());
        int before = queries.get();
        cases.list(tenantA, truck);
        cases.list(tenantB, CaseFilter.OPEN);
        cases.page(tenantA, CaseFilter.OPEN, 1, 1);
        assertEquals(before, queries.get(), "identical filters reuse the tenant's result");
    }

    @Test
    void aCancelledTreatmentRefreshesEveryCachedRead() {
        long id = open(tenantA, symptom(tenantA), "TRUCK-1", 3);
        Treatment treatment = treatments.insert(new Treatment(null, tenantA, -id, "TRUCK-1", null, TreatmentType.CALL,
                TreatmentStatus.OPEN, "ops@example.com", now.atOffset(ZoneOffset.UTC), null, null, null, null,
                null)).treatment();
        assertEquals(1, cases.list(tenantA, CaseFilter.OPEN).get(0).treatments());
        assertEquals(1, cases.page(tenantA, CaseFilter.OPEN, 1, 10).cases().get(0).treatments());
        assertTrue(cases.openCounts(tenantA).get(0).underTreatment());
        assertTrue(cases.matchingCounts(tenantA, CaseFilter.OPEN).get(0).underTreatment());
        assertEquals(1L, cases.treatmentCounts(tenantA, CaseFilter.OPEN)
                .get(EngineCase.TreatmentState.IN_TREATMENT));

        assertTrue(treatments.cancelEmpty(tenantA, treatment.id(), "ops@example.com").isPresent());

        assertEquals(0, cases.list(tenantA, CaseFilter.OPEN).get(0).treatments());
        assertEquals(0, cases.page(tenantA, CaseFilter.OPEN, 1, 10).cases().get(0).treatments());
        assertTrue(cases.openCounts(tenantA).stream().noneMatch(EngineCaseStore.OpenCount::underTreatment));
        assertTrue(cases.matchingCounts(tenantA, CaseFilter.OPEN).stream()
                .noneMatch(EngineCaseStore.OpenCount::underTreatment));
        assertEquals(1L, cases.treatmentCounts(tenantA, CaseFilter.OPEN).get(EngineCase.TreatmentState.UNTREATED));
    }

    @Test
    void startingAndEndingAHoldRefreshesTheMapAndIgnoredCounts() {
        long id = open(tenantA, symptom(tenantA), "TRUCK-1", 3);
        Treatment treatment = treatments.insert(new Treatment(null, tenantA, -id, "TRUCK-1", null,
                TreatmentType.IGNORE_CONDITION, TreatmentStatus.OPEN, "ops@example.com", now.atOffset(ZoneOffset.UTC),
                null, null, null, null, null)).treatment();
        assertEquals(1, inbox(tenantA));
        assertEquals(1, cases.openLevels(tenantA).size());
        assertEquals(0, cases.ignoredCount(tenantA));

        treatments.addAction(new TreatmentAction(null, treatment.id(), tenantA, 0, ActionKind.IGNORE, null,
                null, null, null, null, "reason", "hold", null, 300, null, null,
                List.of(), Map.of("scope", "CASE", "until_trip_end", false), "ops@example.com", null));

        assertEquals(0, inbox(tenantA));
        assertTrue(cases.openLevels(tenantA).isEmpty());
        assertEquals(1, cases.ignoredCount(tenantA));
        assertEquals(1, cases.list(tenantA, CaseFilter.OPEN.withIgnored()).size());

        treatments.transition(tenantA, treatment.id(), TreatmentStatus.CLOSED, "system", "returned_after_ignore",
                null, now.atOffset(ZoneOffset.UTC));

        assertEquals(1, inbox(tenantA));
        assertEquals(1, cases.openLevels(tenantA).size());
        assertEquals(0, cases.ignoredCount(tenantA));
        assertTrue(cases.list(tenantA, CaseFilter.OPEN.withIgnored()).isEmpty());
    }

    @Test
    void aStaleCloseInvalidatesOnlyTenantsWhoseCasesClosed() {
        UUID a = symptom(tenantA);
        open(tenantA, a, "TRUCK-1", 3);
        open(tenantB, symptom(tenantB), "TRUCK-9", 1);
        assertEquals(1, inbox(tenantA));
        assertEquals(1, inbox(tenantB));
        PgIds.query(pool, "UPDATE miot_symptoms.symptom_definition SET state = 'OFF' WHERE id = $1",
                Tuple.of(a));

        assertEquals(1, cases.closeStale(null, null, now, "state_changed").size());
        int before = queries.get();

        assertEquals(0, inbox(tenantA));
        assertEquals(1, inbox(tenantB));
        assertEquals(before + 1, queries.get());
    }

    @Test
    void aTripCloseRefreshesTheCachedListAndCounts() {
        UUID symptom = symptom(tenantA);
        String trip = UUID.randomUUID().toString();
        log.append(tenantA, List.of(new Transition(Kind.OPENED, symptom, "1.0.0", SymptomState.ACTIVE,
                "TRUCK-1", now.minusSeconds(60), 3, 0, 30)),
                new TransitionLog.Place(trip, null, null, null, null));
        assertEquals(1, inbox(tenantA));
        assertEquals(1, cases.list(tenantA, CaseFilter.OPEN).size());

        assertEquals(1, cases.closeTrip(tenantA, trip, null, now, "trip_ended").size());

        assertEquals(0, inbox(tenantA));
        assertTrue(cases.list(tenantA, CaseFilter.OPEN).isEmpty());
    }

    @Test
    void transactionsBypassCachedValuesAndInvalidateOnlyAfterCommit() {
        AtomicInteger loads = new AtomicInteger();
        assertEquals(1, cache.get(tenantA, "test", loads::incrementAndGet));

        PgTx.inTransaction(pool, () -> {
            assertEquals(2, cache.get(tenantA, "test", loads::incrementAndGet));
            assertEquals(3, cache.get(tenantA, "test", loads::incrementAndGet));
            cache.invalidateAfterCommit(tenantA);
            return null;
        });

        assertEquals(4, cache.get(tenantA, "test", loads::incrementAndGet));
        assertThrows(IllegalStateException.class, () -> PgTx.inTransaction(pool, () -> {
            cache.invalidateAfterCommit(tenantA);
            throw new IllegalStateException("rollback");
        }));
        assertEquals(4, cache.get(tenantA, "test", loads::incrementAndGet), "rollback retains committed data");
    }
}

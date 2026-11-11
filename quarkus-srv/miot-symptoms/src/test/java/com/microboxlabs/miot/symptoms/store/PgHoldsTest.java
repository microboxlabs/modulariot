package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseService;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
import com.microboxlabs.miot.symptoms.cases.IgnoreHold;
import com.microboxlabs.miot.symptoms.cases.SlaStore;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.Treatment;
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
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * "Ignorar condición" holds against a real database: the tower's lists and counts, the SLA timer and the hold
 * store. Skipped unless {@code -Dmiot.symptoms.test.pg-url=...} is set; drops and re-creates {@code miot_symptoms}.
 */
@EnabledIfSystemProperty(named = PgTreatmentStoresTest.URL_PROPERTY, matches = ".+")
class PgHoldsTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final List<String> MIGRATIONS = List.of("V0.8.0__create_symptoms_catalog.sql",
            "V0.8.1__create_control_tower_treatments.sql", "V0.8.2__extend_contacts.sql",
            "V0.8.3__create_tower_settings.sql", "V0.8.4__create_signal_transitions.sql", "V0.8.5__signal_cases.sql",
            "V0.9.7__sla_expiry.sql", "V0.12.10__transition_context.sql", "V0.12.13__held_transitions.sql",
            "V0.12.26__after_trip_end_policy.sql", "V0.12.27__transition_operator.sql");
    private static final String SPEC = """
            {"levels":[{"icu":1,"applies":true,"when":"true","response":{"operator":false}},
                       {"icu":3,"applies":true,"when":"true","response":{"operator":true,"slaMinutes":15}}]}
            """;
    private static final String TRUCK = "DEMO01";
    private static final TransitionLog.Place NOWHERE = new TransitionLog.Place(null, null, null, null, null);

    private static Vertx vertx;
    private static Pool pool;

    private final PgTransitionLog log = new PgTransitionLog(() -> pool);
    private final PgEngineCases cases = new PgEngineCases(() -> pool);
    private final PgSlaStore sla = new PgSlaStore(() -> pool);
    private final PgTreatmentStore treatments = new PgTreatmentStore(() -> pool);
    private final PgHoldStore holds = new PgHoldStore(() -> pool);
    private final Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    private final String tenant = "tenant-" + UUID.randomUUID();

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
            try (InputStream in = PgHoldsTest.class.getResourceAsStream("/db/migration/symptoms/" + file)) {
                pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
            }
        }
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    private UUID symptom(String key) {
        return symptom(key, SPEC);
    }

    private UUID symptom(String key, String spec) {
        UUID id = UUID.randomUUID();
        PgIds.query(pool, """
                INSERT INTO miot_symptoms.symptom_definition
                    (id, tenant_code, symptom_key, name, source_key, state, current_version, created_by, updated_by)
                VALUES ($1, $2, $3, $3, 'gps_signal', 'ACTIVE', '1.0.0', 't', 't')
                """, Tuple.of(id, tenant, key));
        PgIds.query(pool, """
                INSERT INTO miot_symptoms.symptom_version
                    (definition_id, tenant_code, version, status, spec, created_by)
                VALUES ($1, $2, '1.0.0', 'PUBLISHED', $3::text::jsonb, 't')
                """, Tuple.of(id, tenant, spec));
        return id;
    }

    private long open(UUID symptom, String asset, Instant at, int level, String tripId) {
        return log.append(tenant, List.of(new Transition(Kind.OPENED, symptom, "1.0.0", SymptomState.ACTIVE, asset,
                at, level, 0, 30)), new TransitionLog.Place(tripId, null, null, null, null)).get(0).caseId();
    }

    /** An operator's hold on the case from {@code at}. */
    private String hold(long caseId, Instant at, Integer seconds, String scope, boolean tripEnd) {
        Treatment t = treatments.insert(new Treatment(null, tenant, -caseId, TRUCK, null,
                TreatmentType.IGNORE_CONDITION, TreatmentStatus.OPEN, "ops@example.com", at.atOffset(ZoneOffset.UTC), null, null, null, null,
                null)).treatment();
        TreatmentAction a = treatments.addAction(new TreatmentAction(null, t.id(), tenant, 0, ActionKind.IGNORE, null,
                null, null, null, null, "ignore_reason_2", "Zona de sombra GPS conocida", null, seconds, null, null,
                List.of(), Map.of("scope", scope, "until_trip_end", tripEnd), "ops@example.com", null));
        PgIds.query(pool, "UPDATE miot_symptoms.treatment_action SET performed_at = $2 WHERE id = $1::uuid",
                Tuple.of(a.id(), at.atOffset(ZoneOffset.UTC)));
        return t.id();
    }

    private void end(String treatmentId, Instant at) {
        treatments.transition(tenant, treatmentId, TreatmentStatus.CLOSED, "system", "returned_after_ignore", null,
                at.atOffset(ZoneOffset.UTC));
    }

    private List<Long> openIds() {
        return cases.list(tenant, EngineCaseStore.CaseFilter.OPEN).stream().map(EngineCase::id).sorted().toList();
    }

    private List<Long> ignoredIds() {
        return cases.list(tenant, EngineCaseStore.CaseFilter.OPEN.withIgnored()).stream().map(EngineCase::id)
                .sorted().toList();
    }

    private long counted() {
        return cases.openCounts(tenant).stream().mapToLong(EngineCaseStore.OpenCount::count).sum();
    }

    private List<Long> inboxIds() {
        return cases.list(tenant, EngineCaseStore.CaseFilter.OPEN.forOperator()).stream().map(EngineCase::id)
                .sorted().toList();
    }

    private long inboxCounted() {
        return cases.towerCounts(tenant).active().stream().mapToLong(EngineCaseStore.OpenCount::count).sum();
    }

    private void changeLevel(UUID symptom, String asset, Instant at, int level, int previous) {
        log.append(tenant, List.of(new Transition(Kind.LEVEL_CHANGED, symptom, "1.0.0", SymptomState.ACTIVE, asset,
                at, level, previous, 30)), NOWHERE);
    }

    @Test
    void theInboxFollowsTheOperatorFlagOfTheCurrentLevel() {
        UUID speeding = symptom("inbox-speeding");
        long quiet = open(speeding, TRUCK, now.minusSeconds(600), 1, null);
        long loud = open(speeding, "DEMO02", now.minusSeconds(500), 3, null);

        assertEquals(List.of(loud), inboxIds(), "level 1 has operator false");
        assertEquals(1, inboxCounted());
        assertEquals(List.of(quiet, loud), openIds(), "without the flag every open case is listed");
        assertTrue(cases.list(tenant, new EngineCaseStore.CaseFilter(null, null, null, null,
                now.minusSeconds(3600), now).forOperator()).stream().anyMatch(c -> c.id() == loud));

        changeLevel(speeding, TRUCK, now.minusSeconds(300), 3, 1);
        assertEquals(List.of(quiet, loud), inboxIds(), "escalated to a level with operator true");
        assertEquals(2, inboxCounted());

        changeLevel(speeding, TRUCK, now.minusSeconds(100), 1, 3);
        assertEquals(List.of(loud), inboxIds(), "back down to operator false");
        assertEquals(1, inboxCounted());
        assertEquals(2, cases.openLevels(tenant).size(), "the map keeps both");
    }

    @Test
    void theInboxUsesEachCasesVersionEvenAfterAnotherVersionIsPublished() {
        UUID speeding = symptom("inbox-versions");
        long originalLoud = open(speeding, TRUCK, now.minusSeconds(600), 3, null);
        open(speeding, "ORIGINAL-QUIET", now.minusSeconds(500), 1, null);
        PgIds.query(pool, """
                INSERT INTO miot_symptoms.symptom_version
                    (definition_id, tenant_code, version, status, spec, created_by)
                VALUES ($1, $2, '2.0.0', 'PUBLISHED',
                    '{"levels":[{"icu":1,"response":{"operator":true}},
                                {"icu":3,"response":{"operator":false}}]}'::jsonb, 't')
                """, Tuple.of(speeding, tenant));
        PgIds.query(pool, "UPDATE miot_symptoms.symptom_definition SET current_version = '2.0.0' WHERE id = $1",
                Tuple.of(speeding));
        long newLoud = log.append(tenant, List.of(new Transition(Kind.OPENED, speeding, "2.0.0",
                SymptomState.ACTIVE, "NEW-LOUD", now.minusSeconds(400), 1, 0, 30)), NOWHERE).get(0).caseId();
        log.append(tenant, List.of(new Transition(Kind.OPENED, speeding, "2.0.0", SymptomState.ACTIVE,
                "NEW-QUIET", now.minusSeconds(300), 3, 0, 30)), NOWHERE);

        assertEquals(List.of(originalLoud, newLoud), inboxIds());
        assertEquals(2, inboxCounted());

        PgIds.query(pool, "UPDATE miot_symptoms.symptom_version SET spec = to_jsonb(spec::text) WHERE definition_id = $1",
                Tuple.of(speeding));
        assertEquals(List.of(originalLoud, newLoud), inboxIds(), "legacy JSON-string specs use the same rule");
        assertEquals(2, inboxCounted());
    }

    @Test
    void heldAndUnderTreatmentCountersFollowTheSameOperatorRuleAsTheirLists() {
        UUID speeding = symptom("inbox-treatment");
        long quiet = open(speeding, TRUCK, now.minusSeconds(600), 1, null);
        long loud = open(speeding, "LOUD", now.minusSeconds(500), 3, null);
        hold(quiet, now.minusSeconds(60), 1800, "CASE", false);
        String loudHold = hold(loud, now.minusSeconds(60), 1800, "CASE", false);
        EngineCaseStore.CaseFilter ignored = EngineCaseStore.CaseFilter.OPEN.withIgnored().forOperator();

        assertEquals(List.of(loud), cases.list(tenant, ignored).stream().map(EngineCase::id).toList());
        assertEquals(1, cases.towerCounts(tenant).ignored());
        assertEquals(0, inboxCounted());
        assertTrue(inboxIds().isEmpty());

        changeLevel(speeding, "LOUD", now.minusSeconds(30), 1, 3);
        assertTrue(cases.list(tenant, ignored).isEmpty());
        assertEquals(0, cases.towerCounts(tenant).ignored());
        end(loudHold, now.minusSeconds(20));
        treatments.insert(new Treatment(null, tenant, -loud, "LOUD", null, TreatmentType.CALL,
                TreatmentStatus.OPEN, "ops@example.com", now.atOffset(ZoneOffset.UTC), null, null, null, null,
                null));
        EngineCaseStore.CaseFilter treated = EngineCaseStore.CaseFilter.OPEN.withOpenTreatment().forOperator();
        assertTrue(cases.list(tenant, treated).isEmpty());
        assertEquals(0, inboxCounted());

        changeLevel(speeding, "LOUD", now.minusSeconds(10), 3, 1);
        assertEquals(List.of(loud), cases.list(tenant, treated).stream().map(EngineCase::id).toList());
        assertEquals(1, inboxCounted());
        assertTrue(cases.towerCounts(tenant).active().get(0).underTreatment());
    }

    @Test
    void aLevelWithoutAResponseIsNotInTheInbox() {
        UUID speeding = symptom("inbox-no-response", """
                {"levels":[{"icu":3,"applies":true,"when":"true"}]}
                """);
        open(speeding, TRUCK, now.minusSeconds(600), 3, null);

        assertTrue(inboxIds().isEmpty());
        assertEquals(0, inboxCounted());
    }

    @Test
    void theInboxIsOrderedByLevelThenSlaThenArrivalAtTheLevel() {
        UUID speeding = symptom("order-speeding");
        UUID panic = symptom("order-panic", """
                {"levels":[{"icu":4,"applies":true,"when":"true","response":{"operator":true}}]}
                """);
        long black = open(panic, "DEMO09", now.minusSeconds(60), 4, null);
        long newer = open(speeding, "DEMO02", now.minusSeconds(300), 3, null);
        long older = open(speeding, "DEMO03", now.minusSeconds(900), 3, null);
        long escalated = open(speeding, TRUCK, now.minusSeconds(3000), 1, null);
        changeLevel(speeding, TRUCK, now.minusSeconds(120), 3, 1);

        assertEquals(now.minusSeconds(120), cases.find(tenant, escalated).orElseThrow().levelAt());
        EngineCaseService service = new EngineCaseService(cases, (t, a, d) -> { }, t -> null,
                Clock.fixed(now, ZoneOffset.UTC));
        JsonNode page = service.casesPage(tenant, Map.of("p_page_size", "10"));
        List<Long> order = new ArrayList<>();
        page.path("data").forEach(r -> order.add(-r.path("id").asLong()));
        assertEquals(List.of(black, older, newer, escalated), order,
                "código negro, then level 3 by the SLA that runs out first: 15 min from reaching the level");
    }

    @Test
    void theInboxKeepsTheMostCriticalCasesWithinItsLimit() {
        UUID speeding = symptom("cap-speeding");
        UUID panic = symptom("cap-panic", """
                {"levels":[{"icu":4,"applies":true,"when":"true","response":{"operator":true}}]}
                """);
        long black = open(panic, "DEMO-BLACK", now.minusSeconds(7200), 4, null);
        List<Transition> many = new ArrayList<>();
        for (int i = 0; i < 205; i++) {
            many.add(new Transition(Kind.OPENED, speeding, "1.0.0", SymptomState.ACTIVE, "DEMO-" + i,
                    now.minusSeconds(600 - i), 3, 0, 30));
        }
        log.append(tenant, many, NOWHERE);

        List<EngineCase> inbox = cases.list(tenant, EngineCaseStore.CaseFilter.OPEN.forOperator());
        assertEquals(200, inbox.size());
        assertTrue(inbox.stream().anyMatch(c -> c.id() == black), "the oldest case is the most critical");
        assertTrue(inbox.stream().anyMatch(c -> c.assetId().equals("DEMO-0")), "earliest SLA is kept");
        assertFalse(inbox.stream().anyMatch(c -> c.assetId().equals("DEMO-199")), "latest SLAs are cut off");
    }

    @Test
    void aLevelMissingFromTheVersionIsNotInTheInbox() {
        UUID speeding = symptom("inbox-unknown-level");
        open(speeding, TRUCK, now.minusSeconds(600), 2, null);

        assertTrue(inboxIds().isEmpty());
        assertEquals(0, inboxCounted());
    }

    @Test
    void historyIncludesEndedScopedHoldsButExcludesHoldsOutsideTheCaseLifetime() {
        UUID symptom = symptom("history");
        UUID other = symptom("other-history");
        long source = open(other, TRUCK, now.minusSeconds(900), 3, null);
        long target = open(symptom, TRUCK, now.minusSeconds(600), 3, null);
        String before = hold(source, now.minusSeconds(800), 60, "ALL", false);
        end(before, now.minusSeconds(740));
        String overlapping = hold(source, now.minusSeconds(700), 300, "ALL", false);
        end(overlapping, now.minusSeconds(400));
        String own = hold(target, now.minusSeconds(350), 100, "CASE", false);
        end(own, now.minusSeconds(250));
        String wrongSymptom = hold(source, now.minusSeconds(240), 60, "SYMPTOM", false);
        end(wrongSymptom, now.minusSeconds(180));
        cases.close(tenant, target, "operator@example.test", now.minusSeconds(100));
        hold(source, now.minusSeconds(50), 300, "ALL", false);
        EngineCase closed = cases.find(tenant, target).orElseThrow();

        assertNotNull(closed.ignored(), "the current snapshot sees the later global hold");
        assertEquals(List.of(overlapping, own), cases.holds(tenant, closed, closed.closedAt()).stream()
                .map(EngineCase.Ignored::treatmentId).toList());
        assertTrue(cases.holds("another-tenant", closed, closed.closedAt()).isEmpty());
    }

    @Test
    void aHeldCaseLeavesTheActiveListAndCountsAndShowsUnderIgnored() {
        UUID speeding = symptom("speeding");
        UUID stop = symptom("stop");
        long a = open(speeding, TRUCK, now.minusSeconds(600), 3, null);
        long b = open(stop, TRUCK, now.minusSeconds(500), 1, null);
        long c = open(speeding, "DEMO02", now.minusSeconds(400), 1, null);
        String hold = hold(a, now.minusSeconds(60), 1800, "CASE", false);

        assertEquals(List.of(b, c), openIds());
        assertEquals(List.of(a), ignoredIds());
        assertEquals(2, counted());
        assertEquals(1, cases.ignoredCount(tenant));
        assertEquals(2, cases.openLevels(tenant).size());
        EngineCase held = cases.find(tenant, a).orElseThrow();
        assertEquals(hold, held.ignored().treatmentId());
        assertEquals(now.minusSeconds(60).plusSeconds(1800), held.ignored().until());
        assertEquals("CASE", held.ignored().scope());
        assertNull(held.returnedAt());
        assertEquals(List.of(a, b, c), cases.list(tenant, new EngineCaseStore.CaseFilter(null, null, null, null,
                now.minusSeconds(3600), now)).stream().map(EngineCase::id).sorted().toList(),
                "a date range lists every case");
    }

    @Test
    void scopesCoverTheSameSymptomOrEverySymptomOfTheVehicle() {
        UUID speeding = symptom("speeding");
        UUID stop = symptom("stop");
        long a = open(speeding, TRUCK, now.minusSeconds(600), 3, null);
        long a2 = open(speeding, "DEMO02", now.minusSeconds(550), 3, null);
        long b = open(stop, TRUCK, now.minusSeconds(500), 1, null);

        String symptomHold = hold(a, now.minusSeconds(60), 1800, "SYMPTOM", false);
        assertEquals(List.of(a2, b), openIds());
        end(symptomHold, now.minusSeconds(30));
        hold(a, now.minusSeconds(20), 1800, "ALL", false);
        assertEquals(List.of(a2), openIds());
        assertEquals(List.of(a, b), ignoredIds());
        assertEquals("ALL", cases.find(tenant, b).orElseThrow().ignored().scope());
    }

    @Test
    void anExpiredHoldStaysCoveredUntilItsReturnIsRecorded() {
        UUID speeding = symptom("speeding");
        long a = open(speeding, TRUCK, now.minusSeconds(3600), 3, null);
        hold(a, now.minusSeconds(1800), 300, "CASE", false);

        assertTrue(openIds().isEmpty());
        assertEquals(List.of(a), ignoredIds());
        IgnoreHold h = holds.open(tenant).get(0);
        assertFalse(h.activeAt(now), "still open until the timer ends it");
    }

    @Test
    void anEndedHoldBringsTheCaseBackAndItsSlaRunsFromThen() {
        UUID speeding = symptom("speeding");
        UUID stop = symptom("stop");
        Instant opened = now.minusSeconds(3600);
        long a = open(speeding, TRUCK, opened, 3, null);
        long b = open(stop, TRUCK, opened.plusSeconds(1), 3, null);
        String hold = hold(a, opened.plusSeconds(120), 7200, "ALL", false);

        assertTrue(due().isEmpty(), "a held case is attended, also when another case's hold covers it");

        Instant back = now.minusSeconds(600);
        end(hold, back);
        assertEquals(back, cases.find(tenant, a).orElseThrow().returnedAt());
        assertEquals(back, cases.find(tenant, b).orElseThrow().returnedAt());
        assertTrue(due().isEmpty(), "the SLA runs again from the return: 10 of 15 minutes");
        List<SlaStore.Due> later = sla.due(now.minusSeconds(7200), now.plusSeconds(6 * 60), 100).stream()
                .filter(d -> d.tenantCode().equals(tenant)).toList();
        assertEquals(2, later.size(), "both cases need attention again after returning");
        assertTrue(later.stream().allMatch(d -> d.levelSince().equals(back)));
        assertTrue(later.stream().allMatch(d -> cases.find(tenant, d.engineCase().id()).orElseThrow()
                .slaStart().equals(d.levelSince())), "inbox SLA start equals the timer's start after a hold");
    }

    @Test
    void aLevelChangeAfterReturningFromAHoldStartsANewSla() {
        UUID speeding = symptom("inbox-sla-level");
        long id = open(speeding, TRUCK, now.minusSeconds(3600), 3, null);
        String hold = hold(id, now.minusSeconds(3000), 300, "CASE", false);
        end(hold, now.minusSeconds(2400));
        changeLevel(speeding, TRUCK, now.minusSeconds(1800), 1, 3);
        Instant levelAt = now.minusSeconds(1200);
        changeLevel(speeding, TRUCK, levelAt, 3, 1);

        SlaStore.Due due = due().get(0);
        EngineCase inbox = cases.list(tenant, EngineCaseStore.CaseFilter.OPEN.forOperator()).get(0);
        assertEquals(id, due.engineCase().id());
        assertEquals(levelAt, due.levelSince());
        assertEquals(due.levelSince(), inbox.slaStart());
        assertEquals(levelAt.plusSeconds(900), inbox.slaDeadline());
        EngineCaseService service = new EngineCaseService(cases, (t, a, d) -> { }, t -> null,
                Clock.fixed(now, ZoneOffset.UTC));
        assertEquals(due.levelSince().toString(), service.casesPage(tenant, Map.of())
                .path("data").get(0).path("sla_since").asText());
    }

    private List<SlaStore.Due> due() {
        return sla.due(now.minusSeconds(7200), now, 100).stream().filter(d -> d.tenantCode().equals(tenant)).toList();
    }

    @ParameterizedTest
    @ValueSource(strings = { "ALL", "SYMPTOM" })
    void holdsEndingAfterACaseClosedDoNotReplaceItsLastSlaStart(String scope) {
        UUID speeding = symptom("closed-sla");
        long closed = open(speeding, TRUCK, now.minusSeconds(3600), 3, null);
        String originalHold = hold(closed, now.minusSeconds(3000), 300, "CASE", false);
        Instant originalReturn = now.minusSeconds(2400);
        end(originalHold, originalReturn);
        assertTrue(cases.close(tenant, closed, "ops@example.com", now.minusSeconds(1800)));
        long next = open(speeding, TRUCK, now.minusSeconds(1200), 3, null);
        String laterHold = hold(next, now.minusSeconds(1100), 300, scope, false);
        Instant laterReturn = now.minusSeconds(800);
        end(laterHold, laterReturn);

        EngineCase history = cases.find(tenant, closed).orElseThrow();
        assertEquals(originalReturn, history.returnedAt());
        assertEquals(originalReturn, history.slaStart());
        assertEquals(laterReturn, cases.find(tenant, next).orElseThrow().slaStart());
        EngineCaseService service = new EngineCaseService(cases, (t, a, d) -> { }, t -> null,
                Clock.fixed(now, ZoneOffset.UTC));
        JsonNode page = service.casesPage(tenant, Map.of("p_start_date_historic", now.minusSeconds(7200).toString(),
                "p_end_date_historic", now.toString()));
        List<JsonNode> rows = new ArrayList<>();
        page.path("data").forEach(rows::add);
        JsonNode row = rows.stream().filter(r -> r.path("id").asLong() == -closed).findFirst().orElseThrow();
        assertEquals(originalReturn.toString(), row.path("sla_since").asText());
    }

    @Test
    void aReturnedCaseCanBreachAgainAtTheSameLevelExactlyOnce() {
        UUID speeding = symptom("repeat-sla");
        Instant opened = now.minusSeconds(7000);
        long id = open(speeding, TRUCK, opened, 3, null);
        assertTrue(sla.markExpired(tenant, id, 3, 15, opened.plusSeconds(901)));
        String hold = hold(id, opened.plusSeconds(1200), 300, "CASE", false);
        assertTrue(due().isEmpty(), "no breach while held");
        Instant returned = now.minusSeconds(1200);
        end(hold, returned);

        SlaStore.Due next = due().stream().filter(d -> d.engineCase().id() == id).findFirst().orElseThrow();
        assertEquals(returned, next.levelSince());
        assertTrue(sla.markExpired(next, now));
        assertFalse(sla.markExpired(next, now.plusSeconds(60)), "one mark per attention period across pods");
        assertTrue(due().isEmpty());
    }

    @Test
    void theHoldStoreReadsOpenHoldsTheirCaseAndTheTrip() {
        UUID speeding = symptom("speeding");
        UUID trip = UUID.randomUUID();
        long a = open(speeding, TRUCK, now.minusSeconds(600), 3, trip.toString());
        String id = hold(a, now.minusSeconds(60), null, "CASE", true);

        IgnoreHold h = holds.find(tenant, id).orElseThrow();
        assertEquals(a, h.caseId());
        assertEquals(TRUCK, h.assetId());
        assertEquals(speeding, h.definitionId());
        assertEquals(trip.toString(), h.tripId());
        assertTrue(h.untilTripEnd());
        assertNull(h.until());
        assertFalse(h.caseClosed());
        assertTrue(holds.open(1000).stream().anyMatch(x -> x.id().equals(id)));
        assertEquals(false, holds.tripLive(tenant, trip.toString(), TRUCK).orElseThrow());
        PgIds.query(pool, "INSERT INTO miot_trips.trip_live (trip_id, tenant_code, asset_id) VALUES ($1, $2, $3)",
                Tuple.of(trip, tenant, TRUCK));
        assertEquals(true, holds.tripLive(tenant, trip.toString(), TRUCK).orElseThrow());

        cases.close(tenant, a, "ops@example.com", now);
        assertTrue(holds.find(tenant, id).orElseThrow().caseClosed());
        assertTrue(holds.find(tenant, "not-a-uuid").isEmpty());
        end(id, now);
        assertTrue(holds.open(tenant).isEmpty());
    }

    @Test
    void scopedReadsIncludeEveryCaseOfTheExactAsset() {
        UUID speeding = symptom("many-cases");
        for (int i = 0; i < 205; i++) {
            open(speeding, TRUCK, now.minusSeconds(600 + i), 3, null);
        }
        open(speeding, TRUCK + "-OTHER", now.minusSeconds(100), 3, null);
        assertEquals(205, cases.openForAsset(tenant, TRUCK).size());
    }

    @Test
    void anotherPodCannotChangeTheSameVehiclesHoldAtTheSameTime() {
        java.util.function.Supplier<Void> nothing = () -> null;
        holds.locked(tenant, TRUCK, () -> {
            assertThrows(IllegalStateException.class, () -> holds.locked(tenant, TRUCK, nothing));
            assertNull(holds.locked(tenant, "OTHER-TRUCK", nothing));
            return null;
        });
        assertNull(holds.locked(tenant, TRUCK, nothing), "released after the first operation");
    }

    private static final String OPERATOR = "ops@example.com";

    /** A treatment of the case opened at {@code at}, with one action of {@code kind} when given. */
    private String treat(long caseId, String operator, Instant at, ActionKind kind, String outcome) {
        Treatment t = treatments.insert(new Treatment(null, tenant, -caseId, TRUCK, null, TreatmentType.CALL,
                TreatmentStatus.OPEN, operator, at.atOffset(ZoneOffset.UTC), null, null, null, null, null))
                .treatment();
        if (kind != null) {
            treatments.addAction(new TreatmentAction(null, t.id(), tenant, 0, kind,
                    null, kind == ActionKind.CALL ? "Conductor" : null, null, null, null, null, outcome, null, null,
                    null, kind == ActionKind.NOTE ? "Gestionado por radio" : null, List.of(), Map.of(), operator,
                    null));
        }
        return t.id();
    }

    private void finish(String treatmentId, Instant at) {
        treatments.transition(tenant, treatmentId, TreatmentStatus.CLOSED, OPERATOR, null, null,
                at.atOffset(ZoneOffset.UTC));
    }

    private List<Long> inState(EngineCase.TreatmentState state, EngineCaseStore.CaseFilter filter) {
        return cases.list(tenant, filter.treatment(state)).stream().map(EngineCase::id).sorted().toList();
    }

    private EngineCase listed(long caseId, EngineCaseStore.CaseFilter filter) {
        return cases.list(tenant, filter).stream().filter(c -> c.id() == caseId).findFirst().orElseThrow();
    }

    @Test
    void eachCaseHasItsTreatmentStateWithTheEpisodesBehindIt() {
        UUID speeding = symptom("treatment-states");
        long untreated = open(speeding, TRUCK, now.minusSeconds(900), 3, null);
        long treating = open(speeding, "DEMO02", now.minusSeconds(800), 3, null);
        treat(treating, "first@example.com", now.minusSeconds(700), ActionKind.CALL, "No contesta");
        String mine = treat(treating, OPERATOR, now.minusSeconds(600), null, null);
        long called = open(speeding, "DEMO03", now.minusSeconds(790), 3, null);
        finish(treat(called, OPERATOR, now.minusSeconds(500), ActionKind.CALL, "Contesta"), now.minusSeconds(400));
        cases.close(tenant, called, OPERATOR, now.minusSeconds(400));
        long handled = open(speeding, "DEMO04", now.minusSeconds(780), 3, null);
        String note = treat(handled, OPERATOR, now.minusSeconds(500), ActionKind.NOTE, "Resuelto");
        treatments.addAction(new TreatmentAction(null, note, tenant, 0, ActionKind.NOTE, null, null, null, null,
                null, null, null, null, null, null, "Sin resultado", List.of(), Map.of(), OPERATOR, null));
        finish(note, now.minusSeconds(300));
        long back = open(speeding, "DEMO05", now.minusSeconds(770), 3, null);
        end(hold(back, now.minusSeconds(600), 60, "CASE", false), now.minusSeconds(200));
        long abandoned = open(speeding, "DEMO06", now.minusSeconds(760), 3, null);
        treatments.transition(tenant, treat(abandoned, OPERATOR, now.minusSeconds(500), null, null),
                TreatmentStatus.CANCELLED, OPERATOR, "cancelled", null);

        EngineCaseStore.CaseFilter open = EngineCaseStore.CaseFilter.OPEN;
        EngineCaseStore.CaseFilter history = new EngineCaseStore.CaseFilter(null, null, null, null,
                now.minusSeconds(3600), now.plusSeconds(60));
        assertEquals(List.of(untreated, back, abandoned), inState(EngineCase.TreatmentState.UNTREATED, open),
                "a cancelled treatment does not count, and a case back from a hold waits again");
        assertEquals(List.of(treating), inState(EngineCase.TreatmentState.IN_TREATMENT, open));
        assertEquals(List.of(handled), inState(EngineCase.TreatmentState.TREATED, open));
        assertEquals(List.of(called, handled), inState(EngineCase.TreatmentState.TREATED, history),
                "a treated case stays treated after it closes");
        assertEquals(6, cases.list(tenant, history).size(), "without the state every case is listed");

        EngineCase.CaseTreatment both = listed(treating, open).treatment();
        assertEquals(EngineCase.TreatmentState.IN_TREATMENT, both.state());
        assertEquals(List.of("first@example.com", OPERATOR),
                both.open().stream().map(EngineCase.Episode::openedBy).toList(), "oldest first");
        assertEquals(mine, both.shown(OPERATOR).id());
        assertEquals(now.minusSeconds(600), both.shown(OPERATOR).openedAt());
        assertTrue(both.openBy(OPERATOR));
        assertFalse(both.openBy("third@example.com"));
        assertEquals("first@example.com", both.shown("third@example.com").openedBy());

        EngineCase.Episode call = listed(called, history).treatment().last();
        assertEquals("call", call.outcome());
        assertEquals("Contesta", call.outcomeLabel());
        assertEquals(OPERATOR, call.closedBy());
        assertEquals(now.minusSeconds(400), call.closedAt());
        assertEquals(now.minusSeconds(500), call.openedAt());
        EngineCase.Episode record = listed(handled, open).treatment().last();
        assertEquals("handling", record.outcome(), "a later plain note does not decide the outcome");
        assertEquals("Resuelto", record.outcomeLabel());
        EngineCase returned = listed(back, open);
        assertEquals(EngineCase.TreatmentState.UNTREATED, returned.treatment().state());
        assertEquals("ignore", returned.treatment().last().outcome());
        assertEquals("returned_after_ignore", returned.treatment().last().resolution());
        assertNull(listed(untreated, open).treatment().last());
        assertEquals(EngineCase.TreatmentState.TREATED, cases.find(tenant, called).orElseThrow().treatmentState());
    }

    @Test
    void theTreatmentStateFiltersBeforePagingAndIsCountedWithoutThePageLimit() {
        UUID speeding = symptom("treatment-paging");
        List<Long> treating = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            long id = open(speeding, "PAGE0" + i, now.minusSeconds(900 - i), 3, null);
            if (i % 2 == 0) {
                treat(id, OPERATOR, now.minusSeconds(100), null, null);
                treating.add(id);
            }
        }
        EngineCaseStore.CaseFilter filter = EngineCaseStore.CaseFilter.OPEN
                .treatment(EngineCase.TreatmentState.IN_TREATMENT);

        EngineCaseStore.CasePage first = cases.page(tenant, filter, 1, 2);
        assertEquals(3, first.total());
        assertEquals(treating.subList(0, 2), first.cases().stream().map(EngineCase::id).sorted().toList(),
                "the oldest at the level first");
        EngineCaseStore.CasePage second = cases.page(tenant, filter, 2, 2);
        assertEquals(3, second.total());
        assertEquals(treating.subList(2, 3), second.cases().stream().map(EngineCase::id).toList());
        assertEquals(5, cases.page(tenant, EngineCaseStore.CaseFilter.OPEN, 1, 2).total());

        Map<EngineCase.TreatmentState, Long> counts = cases.treatmentCounts(tenant, EngineCaseStore.CaseFilter.OPEN);
        assertEquals(3, counts.get(EngineCase.TreatmentState.IN_TREATMENT));
        assertEquals(2, counts.get(EngineCase.TreatmentState.UNTREATED));
        assertNull(counts.get(EngineCase.TreatmentState.TREATED));
        assertEquals(3, cases.matchingCounts(tenant, filter).stream().mapToLong(EngineCaseStore.OpenCount::count)
                .sum());
        assertTrue(cases.matchingCounts(tenant, filter).stream().allMatch(EngineCaseStore.OpenCount::underTreatment));
    }

    @Test
    void aHeldOpeningIsEvidenceNotACase() {
        UUID speeding = symptom("speeding");
        log.append(tenant, List.of(new Transition(Kind.HELD, speeding, "1.0.0", SymptomState.ACTIVE, TRUCK,
                now.minusSeconds(30), 2, 0, 30)), NOWHERE);
        assertTrue(cases.list(tenant, EngineCaseStore.CaseFilter.OPEN).isEmpty());
        assertNotNull(PgIds.query(pool, "SELECT id FROM miot_symptoms.signal_transitions WHERE tenant_code = $1"
                + " AND kind = 'HELD'", Tuple.of(tenant)).iterator().next());
    }
}

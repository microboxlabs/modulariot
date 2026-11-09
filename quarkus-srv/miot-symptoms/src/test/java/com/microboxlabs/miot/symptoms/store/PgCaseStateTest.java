package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import com.microboxlabs.miot.symptoms.api.OrgControlTowerTreatmentsResource;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseService;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.CaseFilter;
import com.microboxlabs.miot.symptoms.cases.HoldIndex;
import com.microboxlabs.miot.symptoms.cases.HoldService;
import com.microboxlabs.miot.symptoms.cases.HoldStore;
import com.microboxlabs.miot.symptoms.cases.IgnoreHold;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.dto.AddActionRequest;
import com.microboxlabs.miot.symptoms.dto.CloseTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.OpenTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.TreatmentView;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog.Place;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog.Recorded;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.service.DemoSeeder;
import com.microboxlabs.miot.symptoms.service.TreatmentService;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Test cases are treatable, and a symptom's state change closes its cases of the old state, against a real
 * database. Skipped unless {@code -Dmiot.symptoms.test.pg-url=postgresql://user:password@host:port/db} is set. The
 * test drops and recreates the {@code miot_symptoms} schema from the module's migrations, so use a scratch database.
 */
@EnabledIfSystemProperty(named = PgCaseStateTest.URL_PROPERTY, matches = ".+")
class PgCaseStateTest {

    static final String URL_PROPERTY = "miot.symptoms.test.pg-url";
    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String ORG = "org-a";
    private static final String TENANT = "client-a";
    private static final String TRUCK = "DEMO01";
    private static final Instant T0 = Instant.parse("2026-11-05T12:00:00Z");
    private static final Place PLACE = new Place(null, -33.4, -70.6, 80.0, null);

    private static Vertx vertx;
    private static Pool pool;

    private final PgEngineCases cases = new PgEngineCases(() -> pool);
    private final PgTransitionLog log = new PgTransitionLog(() -> pool);
    private final List<String> forgotten = new ArrayList<>();
    private final Clock clock = Clock.fixed(T0.plusSeconds(600), ZoneOffset.UTC);
    private final EngineCaseService caseService = new EngineCaseService(cases,
            (tenant, asset, definition) -> forgotten.add(tenant + "/" + asset + "/" + definition), t -> null, clock);
    private UUID speeding;

    @BeforeAll
    static void setUp() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(URL_PROPERTY)))
                .using(vertx).build();
        run("DROP SCHEMA IF EXISTS miot_symptoms CASCADE");
        run("CREATE SCHEMA miot_symptoms");
        Path dir = Path.of("src/main/resources/db/migration/symptoms");
        List<Path> migrations;
        try (Stream<Path> files = Files.list(dir)) {
            migrations = files.filter(p -> p.getFileName().toString().matches("V[0-9.]+__.*\\.sql"))
                    .sorted(Comparator.comparing(PgCaseStateTest::version)).toList();
        }
        for (Path m : migrations) {
            run(Files.readString(m));
        }
    }

    /** {@code V0.12.15__x.sql} sorts after {@code V0.9.7__y.sql}. */
    private static String version(Path p) {
        String v = p.getFileName().toString().substring(1).split("__")[0];
        StringBuilder key = new StringBuilder();
        for (String part : v.split("\\.")) {
            key.append(String.format("%06d", Integer.parseInt(part)));
        }
        return key.toString();
    }

    @AfterAll
    static void tearDown() {
        if (pool != null) {
            pool.close().await().atMost(WAIT);
        }
        if (vertx != null) {
            vertx.close().await().atMost(WAIT);
        }
    }

    private static void run(String sql) {
        pool.query(sql).execute().await().atMost(WAIT);
    }

    @BeforeEach
    void definition() {
        run("TRUNCATE miot_symptoms.trip_end_effects, miot_symptoms.signal_transitions");
        speeding = UUID.randomUUID();
        pool.preparedQuery("""
                INSERT INTO miot_symptoms.symptom_definition
                    (id, tenant_code, symptom_key, name, source_key, state, current_version, created_by, updated_by)
                VALUES ($1, $2, $3, 'Exceso de velocidad', 'gps_signal', 'TEST', '1.0.0', 'test', 'test')""")
                .execute(Tuple.of(speeding, TENANT, "speeding-" + speeding)).await().atMost(WAIT);
    }

    private void setState(SymptomState state) {
        pool.preparedQuery("UPDATE miot_symptoms.symptom_definition SET state = $1 WHERE id = $2")
                .execute(Tuple.of(state.name(), speeding)).await().atMost(WAIT);
    }

    private List<Recorded> append(Kind kind, SymptomState state, int seconds, int level) {
        return log.append(TENANT, List.of(new Transition(kind, speeding, "1.0.0", state, TRUCK,
                T0.plusSeconds(seconds), level, 0, 5)), PLACE);
    }

    private long open(SymptomState state, int seconds) {
        return append(Kind.OPENED, state, seconds, 4).get(0).caseId();
    }

    private void speedVersion(String version, String expression) {
        pool.preparedQuery("""
                INSERT INTO miot_symptoms.symptom_version
                    (definition_id, tenant_code, version, status, spec, created_by)
                VALUES ($1, $2, $3, 'PUBLISHED', jsonb_build_object('measure',
                    jsonb_build_object('expression', $4::text), 'levels', '[]'::jsonb), 'test')""")
                .execute(Tuple.of(speeding, TENANT, version, expression)).await().atMost(WAIT);
    }

    @Test
    void speedEvidenceUsesEachTransitionsVersionAndReachesTheLivePin() {
        setState(SymptomState.ACTIVE);
        speedVersion("1.0.0", "signal.frame.gps.speed - signal.road.maxspeed_osm");
        speedVersion("2.0.0", "double(int(signal.frame.gps.speed + 0.5)) - signal.road.maxspeed_custom");
        Place opening = new Place(null, 0.0, 0.0, 68.25, null);
        long id = log.append(TENANT, List.of(new Transition(Kind.OPENED, speeding, "1.0.0", SymptomState.ACTIVE,
                TRUCK, T0, 2, 0, 18.25)), opening).getFirst().caseId();
        Map<String, Object> kept = Map.of("speed_limit", Map.of("kmh", 50, "source", "custom",
                "road_kmh", 80, "custom_kmh", 50, "zone_name", "Tramo de prueba"));
        log.append(TENANT, List.of(new Transition(Kind.LEVEL_CHANGED, speeding, "2.0.0", SymptomState.ACTIVE,
                TRUCK, T0.plusSeconds(60), 4, 2, 34)), new Place(null, 0.0, 0.0, 83.6, null), kept);

        List<EngineCase.LevelStep> steps = cases.find(TENANT, id).orElseThrow().levels();
        assertEquals(68.25, steps.get(0).speedKmh());
        assertEquals(new EngineCase.SpeedLimit(50, "road", null), steps.get(0).speedLimit());
        assertEquals(84.0, steps.get(1).speedKmh());
        assertEquals(new EngineCase.SpeedLimit(50, "custom", "Tramo de prueba"), steps.get(1).speedLimit());
        assertEquals(steps.get(1), cases.openLevels(TENANT).getFirst().speedStep());
    }

    private OrgControlTowerTreatmentsResource treatments() {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        org.setUserEmail("ops@example.com");
        TenantContext tenant = new TenantContext();
        tenant.setClientId(TENANT);
        HoldStore noHolds = new HoldStore() {
            @Override
            public List<IgnoreHold> open(String tenantCode) {
                return List.of();
            }

            @Override
            public List<IgnoreHold> open(int limit) {
                return List.of();
            }

            @Override
            public Optional<IgnoreHold> find(String tenantCode, String treatmentId) {
                return Optional.empty();
            }

            @Override
            public Optional<Boolean> tripLive(String tenantCode, String tripId, String assetId) {
                return Optional.empty();
            }
        };
        InMemoryTreatmentStore store = new InMemoryTreatmentStore();
        InMemoryContactStore contacts = new InMemoryContactStore();
        AuditService audit = new AuditService(new InMemoryAuditStore());
        HoldService holds = new HoldService(cases, caseService, noHolds, new HoldIndex(noHolds), store, audit,
                (t, c) -> null, clock);
        return new OrgControlTowerTreatmentsResource(tenant, org, new Roles(), null,
                new TreatmentService(store, contacts, new DemoSeeder(false, contacts, store), audit, holds),
                caseService, holds);
    }

    private static final class Roles extends OrganizationRoleService {
        Roles() {
            super(null, null, null);
        }

        @Override
        public Uni<Access> access(String organizationSlug, Caller caller) {
            return Uni.createFrom().item(new Access(1L, organizationSlug, BaseRole.MEMBER, Set.of(),
                    Set.of(ControlTowerAccessCatalog.CASE_TREAT)));
        }
    }

    private static Response call(Uni<Response> uni) {
        return uni.await().atMost(WAIT);
    }

    @Test
    void anOperatorTreatsAndClosesATestCase() {
        long caseId = open(SymptomState.TEST, 0);
        OrgControlTowerTreatmentsResource resource = treatments();

        assertNotNull(caseService.header(TENANT, -caseId), "the case page reads a test case");
        TreatmentView t = (TreatmentView) call(resource.open(ORG, String.valueOf(-caseId),
                new OpenTreatmentRequest(TreatmentType.CALL, TRUCK, null, null))).getEntity();
        assertEquals(201, call(resource.addAction(ORG, t.id(), new AddActionRequest(ActionKind.NOTE, null, null,
                null, null, null, null, null, null, null, null, "Revisado en prueba", null, null))).getStatus());
        Response closed = call(resource.close(ORG, t.id(), new CloseTreatmentRequest(null, null)));

        assertEquals(200, closed.getStatus(), String.valueOf(closed.getEntity()));
        EngineCase c = cases.find(TENANT, caseId).orElseThrow();
        assertNotNull(c.closedAt());
        assertTrue(c.test());
        assertEquals(List.of(TENANT + "/" + TRUCK + "/" + speeding), forgotten, "its episode is dropped");
        Row row = pool.preparedQuery("""
                SELECT state, closed_by FROM miot_symptoms.signal_transitions
                 WHERE definition_id = $1 AND kind = 'CLOSED'""").execute(Tuple.of(speeding))
                .await().atMost(WAIT).iterator().next();
        assertEquals("TEST", row.getString("state"));
        assertEquals("ops@example.com", row.getString("closed_by"));
    }

    @Test
    void aTestCaseStaysOutOfTheListsAndCounts() {
        long caseId = open(SymptomState.TEST, 0);

        assertTrue(cases.find(TENANT, caseId).isPresent());
        assertTrue(cases.open(TENANT).stream().noneMatch(c -> c.id() == caseId));
        assertTrue(cases.list(TENANT, CaseFilter.OPEN).stream().noneMatch(c -> c.id() == caseId));
        assertTrue(cases.openForAsset(TENANT, TRUCK).isEmpty());
        assertTrue(cases.openLevels(TENANT).isEmpty());
        assertTrue(cases.towerCounts(TENANT).active().isEmpty());
        assertTrue(cases.openedCounts(TENANT, T0.minusSeconds(60), T0.plusSeconds(60)).isEmpty());
    }

    @Test
    void testToActiveClosesTheOpenTestCaseOnce() {
        long caseId = open(SymptomState.TEST, 0);
        setState(SymptomState.ACTIVE);

        assertEquals(1, caseService.closeStaleCases(TENANT, speeding));
        assertEquals(0, caseService.closeStaleCases(TENANT, speeding), "a second run closes nothing");
        assertEquals(0, caseService.closeStaleCases(null, null), "nor does the startup sweep");

        EngineCase c = cases.find(TENANT, caseId).orElseThrow();
        assertNotNull(c.closedAt());
        assertEquals(List.of(TENANT + "/" + TRUCK + "/" + speeding), forgotten);
        Row row = pool.preparedQuery("""
                SELECT state, closed_by, context->>'reason' AS reason, context->>'to' AS target
                  FROM miot_symptoms.signal_transitions WHERE definition_id = $1 AND kind = 'CLOSED'""")
                .execute(Tuple.of(speeding)).await().atMost(WAIT).iterator().next();
        assertEquals("TEST", row.getString("state"));
        assertNull(row.getString("closed_by"));
        assertEquals(EngineCaseService.STATE_CHANGE_REASON, row.getString("reason"));
        assertEquals("ACTIVE", row.getString("target"));

        long next = open(SymptomState.ACTIVE, 30);
        assertTrue(cases.open(TENANT).stream().anyMatch(o -> o.id() == next), "the next case is a live one");
    }

    @Test
    void turningASymptomOffClosesItsCasesAndTheStartupSweepFindsOrphans() {
        open(SymptomState.TEST, 0);
        setState(SymptomState.OFF);

        assertEquals(1, caseService.closeStaleCases(null, null), "every organization, every symptom");
        assertEquals(0, caseService.closeStaleCases(null, null));
    }

    @Test
    void concurrentReplicasAndClosersWriteOneClose() {
        long caseId = open(SymptomState.TEST, 0);
        setState(SymptomState.ACTIVE);
        List<CompletableFuture<Integer>> attempts = IntStream.range(0, 12)
                .mapToObj(i -> CompletableFuture.supplyAsync(() -> switch (i % 3) {
                    case 0 -> cases.closeStale(TENANT, speeding, T0.plusSeconds(100 + i), "state change").size();
                    case 1 -> cases.close(TENANT, caseId, "ops@example.com", T0.plusSeconds(100 + i)) ? 1 : 0;
                    default -> append(Kind.CLOSED, SymptomState.TEST, 100 + i, 4).size();
                })).toList();

        assertEquals(1, attempts.stream().mapToInt(CompletableFuture::join).sum());
        assertNotNull(cases.find(TENANT, caseId).orElseThrow().closedAt());
        assertEquals(0, caseService.closeStaleCases(TENANT, speeding));
    }

    @Test
    void theSweepLeavesTheCurrentStatesCaseOpen() {
        long stale = open(SymptomState.TEST, 0);
        setState(SymptomState.ACTIVE);
        long current = open(SymptomState.ACTIVE, 10);

        assertEquals(1, caseService.closeStaleCases(TENANT, speeding));
        assertNotNull(cases.find(TENANT, stale).orElseThrow().closedAt());
        assertNull(cases.find(TENANT, current).orElseThrow().closedAt());
        assertEquals(0, caseService.closeStaleCases(null, null));
    }

    @Test
    void duplicateOldOpeningsAreClosedTogether() {
        open(SymptomState.TEST, 0);
        open(SymptomState.TEST, 10);
        setState(SymptomState.ACTIVE);

        assertEquals(1, caseService.closeStaleCases(TENANT, speeding));
        assertEquals(0, caseService.closeStaleCases(TENANT, speeding));
    }

    @Test
    void aStateChangeClosesAtTheLatestLevel() {
        open(SymptomState.TEST, 0);
        append(Kind.LEVEL_CHANGED, SymptomState.TEST, 10, 2);
        append(Kind.LEVEL_CHANGED, SymptomState.TEST, 20, 3);
        setState(SymptomState.ACTIVE);

        var closed = cases.closeStale(TENANT, speeding, T0.plusSeconds(30), "state change");

        assertEquals(1, closed.size());
        assertEquals(3, closed.getFirst().level());
        Row row = pool.preparedQuery("SELECT level, previous_level FROM miot_symptoms.signal_transitions "
                + "WHERE definition_id = $1 AND kind = 'CLOSED'")
                .execute(Tuple.of(speeding)).await().atMost(WAIT).iterator().next();
        assertEquals(3, row.getInteger("level"));
        assertEquals(3, row.getInteger("previous_level"));
    }

    @Test
    void sameTimeDeviceEventsEscalateOncePerEventId() {
        Transition opening = new Transition(Kind.OPENED, speeding, "1.0.0", SymptomState.TEST, TRUCK, T0, 2, 0, 1);
        Transition escalation = new Transition(Kind.LEVEL_CHANGED, speeding, "1.0.0", SymptomState.TEST,
                TRUCK, T0, 4, 2, 2);
        Map<String, Object> first = Map.of("event_id", "cam-105");
        Map<String, Object> second = Map.of("event_id", "cam-109");
        long id = log.append(TENANT, List.of(opening), PLACE, first).getFirst().caseId();
        assertEquals(1, log.append(TENANT, List.of(escalation), PLACE, second).size());
        assertTrue(log.append(TENANT, List.of(escalation), PLACE, second).isEmpty());
        assertEquals(4, cases.find(TENANT, id).orElseThrow().level());
        assertEquals(1, append(Kind.LEVEL_CHANGED, SymptomState.TEST, 0, 3).size(),
                "a GPS frame keeps its separate timestamp identity");
        assertTrue(append(Kind.LEVEL_CHANGED, SymptomState.TEST, 0, 3).isEmpty());
    }

    @Test
    void aRejectedOpeningRetriesButAReplayDoesNot() {
        open(SymptomState.TEST, 0);
        assertTrue(append(Kind.OPENED, SymptomState.TEST, 0, 4).isEmpty());
        setState(SymptomState.OFF);
        assertThrows(IllegalStateException.class, () -> append(Kind.OPENED, SymptomState.TEST, 10, 4));
        setState(SymptomState.TEST);
        assertEquals(1, append(Kind.OPENED, SymptomState.TEST, 10, 4).size());
    }

    @Test
    void aCachedCatalogCannotCloseACaseOfTheCurrentState() {
        setState(SymptomState.ACTIVE);
        long current = open(SymptomState.ACTIVE, 0);
        Transition staleCatalogClose = new Transition(Kind.CLOSED, speeding, "1.0.0", SymptomState.ACTIVE,
                TRUCK, T0.plusSeconds(10), 4, 4, 5,
                Map.of("reason", Transition.STATE_CHANGE_REASON, "from", "ACTIVE", "to", "TEST"));

        List<Transition> transitions = List.of(staleCatalogClose);
        assertThrows(IllegalStateException.class, () -> log.append(TENANT, transitions, PLACE));
        assertNull(cases.find(TENANT, current).orElseThrow().closedAt());
    }

    @Test
    void theLogWritesNothingInAStateOtherThanItsCase() {
        long testCase = open(SymptomState.TEST, 0);
        setState(SymptomState.ACTIVE);

        assertTrue(append(Kind.NOTED, SymptomState.ACTIVE, 5, 4).isEmpty(), "a note in the new state");
        assertTrue(append(Kind.LEVEL_CHANGED, SymptomState.ACTIVE, 6, 4).isEmpty());
        assertThrows(IllegalStateException.class, () -> append(Kind.OPENED, SymptomState.TEST, 7, 4),
                "a stale catalog retries without saving an episode");
        assertEquals(List.of(testCase), append(Kind.CLOSED, SymptomState.TEST, 8, 4).stream()
                .map(Recorded::caseId).toList(), "the old case still closes in its own state");
        assertTrue(append(Kind.CLOSED, SymptomState.TEST, 9, 4).isEmpty(), "but only once");

        long live = open(SymptomState.ACTIVE, 10);
        assertEquals(List.of(live), append(Kind.NOTED, SymptomState.ACTIVE, 11, 4).stream()
                .map(Recorded::caseId).toList());
        assertTrue(append(Kind.NOTED, SymptomState.TEST, 12, 4).isEmpty());
        assertFalse(append(Kind.HELD, SymptomState.ACTIVE, 13, 4).isEmpty(), "a held opening is evidence only");

        Row mismatched = pool.preparedQuery("""
                SELECT count(*) AS n FROM miot_symptoms.signal_transitions t
                 WHERE t.definition_id = $1 AND t.kind IN ('LEVEL_CHANGED', 'NOTED', 'CLOSED')
                   AND t.state <> (SELECT o.state FROM miot_symptoms.signal_transitions o
                                    WHERE o.definition_id = t.definition_id AND o.asset_id = t.asset_id
                                      AND o.kind = 'OPENED' AND o.id < t.id ORDER BY o.id DESC LIMIT 1)""")
                .execute(Tuple.of(speeding)).await().atMost(WAIT).iterator().next();
        assertEquals(0L, mismatched.getLong("n"));
    }
}

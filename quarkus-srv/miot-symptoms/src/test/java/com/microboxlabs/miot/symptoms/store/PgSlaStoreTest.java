package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.cases.EngineCase;
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
import java.util.Arrays;
import java.util.ArrayList;
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
            "V0.9.7__sla_expiry.sql", "V0.12.10__transition_context.sql");
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
        pool.query("CREATE SCHEMA IF NOT EXISTS miot_trips").execute().await().atMost(WAIT);
        pool.query("""
                CREATE TABLE IF NOT EXISTS miot_trips.trip_live (
                    trip_id uuid PRIMARY KEY, tenant_code text NOT NULL, asset_id text, mandate_codes jsonb)
                """).execute().await().atMost(WAIT);
        pool.query("""
                ALTER TABLE miot_trips.trip_live
                    ADD COLUMN IF NOT EXISTS driver_id text, ADD COLUMN IF NOT EXISTS driver_name text,
                    ADD COLUMN IF NOT EXISTS second_driver_id text, ADD COLUMN IF NOT EXISTS carrier_id text,
                    ADD COLUMN IF NOT EXISTS carrier_name text, ADD COLUMN IF NOT EXISTS origin_geofence_label text,
                    ADD COLUMN IF NOT EXISTS destination_geofence_label text
                """).execute().await().atMost(WAIT);
        pool.query("CREATE SCHEMA IF NOT EXISTS miot_fleet").execute().await().atMost(WAIT);
        pool.query("""
                CREATE TABLE IF NOT EXISTS miot_fleet.carrier (
                    id uuid PRIMARY KEY, tenant_code text NOT NULL, rut text, legal_name text)
                """).execute().await().atMost(WAIT);
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
    void casesReadTheServiceCodeFromTheFirstMandate() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        UUID tripId = UUID.randomUUID();
        Instant at = Instant.parse("2026-01-01T00:00:00Z");
        long id = log.append(tenant, List.of(t(Kind.OPENED, speeding, at, 3, 0)),
                new TransitionLog.Place(tripId.toString(), null, null, null, null)).get(0).caseId();
        PgEngineCases cases = new PgEngineCases(() -> pool);
        assertNull(cases.find(tenant, id).orElseThrow().tripCode(), "no live trip");
        PgIds.query(pool, """
                INSERT INTO miot_trips.trip_live (trip_id, tenant_code, asset_id, mandate_codes)
                VALUES ($1, $2, 'DEMO01', $3::text::jsonb)
                """, Tuple.of(tripId, tenant, "[{\"code\":\"SERVICE-001\"},{\"code\":\"SERVICE-002\"}]"));

        assertEquals("SERVICE-001", cases.list(tenant, EngineCaseStore.CaseFilter.OPEN).get(0).tripCode());
        assertEquals("SERVICE-001", cases.open(tenant).get(0).tripCode());
        assertEquals(tripId.toString(), cases.find(tenant, id).orElseThrow().tripId());
        assertEquals("SERVICE-001", cases.find(tenant, id).orElseThrow().tripCode());
        for (String codes : List.of("[]", "[{\"code\":null}]", "[{\"code\":\"  \"}]", "null", "\"not-json\"")) {
            PgIds.query(pool, "UPDATE miot_trips.trip_live SET mandate_codes = $2::text::jsonb WHERE trip_id = $1",
                    Tuple.of(tripId, codes));
            assertNull(cases.find(tenant, id).orElseThrow().tripCode());
        }
        // Some projections encode the JSON array as a JSON string.
        PgIds.query(pool, "UPDATE miot_trips.trip_live SET mandate_codes = to_jsonb($2::text) WHERE trip_id = $1",
                Tuple.of(tripId, "[{\"code\":\"SERVICE-001\"}]"));
        assertEquals("SERVICE-001", cases.find(tenant, id).orElseThrow().tripCode());
        PgIds.query(pool, "UPDATE miot_trips.trip_live SET tenant_code = 'another-tenant' WHERE trip_id = $1",
                Tuple.of(tripId));
        assertNull(cases.find(tenant, id).orElseThrow().tripCode(), "another tenant's trip");
        PgIds.query(pool, "UPDATE miot_trips.trip_live SET tenant_code = $2, asset_id = 'another-vehicle' WHERE trip_id = $1",
                Tuple.of(tripId, tenant));
        assertEquals("SERVICE-001", cases.find(tenant, id).orElseThrow().tripCode(),
                "the service code still belongs to the trip after its vehicle changes");
    }

    @Test
    void malformedTripDataAndNonUuidIdsDoNotHideValidCodesOnThePage() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        UUID validTrip = UUID.randomUUID();
        UUID malformedTrip = UUID.randomUUID();
        Instant at = Instant.parse("2026-01-01T00:00:00Z");
        log.append(tenant, List.of(t(Kind.OPENED, speeding, at, 3, 0)),
                new TransitionLog.Place(validTrip.toString(), null, null, null, null));
        log.append(tenant, List.of(new Transition(Kind.OPENED, speeding, "1.0.0", SymptomState.ACTIVE,
                "vehicle-other", at.plusSeconds(1), 3, 0, 30)),
                new TransitionLog.Place(malformedTrip.toString(), null, null, null, null));
        log.append(tenant, List.of(new Transition(Kind.OPENED, speeding, "1.0.0", SymptomState.ACTIVE,
                "vehicle-third", at.plusSeconds(2), 3, 0, 30)),
                new TransitionLog.Place("not-a-uuid", null, null, null, null));
        PgIds.query(pool, """
                INSERT INTO miot_trips.trip_live (trip_id, tenant_code, asset_id, mandate_codes)
                VALUES ($1, $2, 'DEMO01', '[{"code":"SERVICE-001"}]'),
                       ($3, $2, 'vehicle-other', '"not-json"')
                """, Tuple.of(validTrip, tenant, malformedTrip));
        PgEngineCases cases = new PgEngineCases(() -> pool);

        for (List<EngineCase> page : List.of(cases.list(tenant, EngineCaseStore.CaseFilter.OPEN), cases.open(tenant))) {
            assertEquals(List.of("not-a-uuid", malformedTrip.toString(), validTrip.toString()),
                    page.stream().map(EngineCase::tripId).toList());
            assertEquals(Arrays.asList(null, null, "SERVICE-001"), page.stream().map(EngineCase::tripCode).toList());
        }
    }

    @Test
    void openLevelsAreEveryOpenCaseAtItsCurrentLevel() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        Instant t0 = Instant.parse("2026-10-22T03:00:00Z");
        TransitionLog.Place place = new TransitionLog.Place(null, null, null, null, null);
        long closed = log.append(tenant, List.of(t(Kind.OPENED, speeding, t0, 3, 0)), place).get(0).caseId();
        PgEngineCases cases = new PgEngineCases(() -> pool);
        cases.close(tenant, closed, "ops@example.com", t0.plusSeconds(60));
        log.append(tenant, List.of(t(Kind.OPENED, speeding, t0.plusSeconds(120), 1, 0)), place);
        log.append(tenant, List.of(t(Kind.LEVEL_CHANGED, speeding, t0.plusSeconds(180), 4, 1)), place);

        assertEquals(List.of(new EngineCaseStore.OpenLevel("DEMO01", "Exceso de velocidad", 4)),
                cases.openLevels(tenant));
        assertTrue(cases.openLevels("other-" + tenant).isEmpty());
    }

    private static UUID liveTrip(String tenant, String driver, String secondDriver, UUID carrier, String origin,
            String destination) {
        UUID trip = UUID.randomUUID();
        PgIds.query(pool, """
                INSERT INTO miot_trips.trip_live (trip_id, tenant_code, asset_id, driver_id, driver_name,
                    second_driver_id, carrier_id, carrier_name, origin_geofence_label, destination_geofence_label)
                VALUES ($1, $2, 'DEMO01', $3, 'Driver ' || $3, $4, $5, 'Carrier', $6, $7)
                """, Tuple.tuple().addUUID(trip).addString(tenant).addString(driver).addString(secondDriver)
                .addString(carrier == null ? null : carrier.toString()).addString(origin).addString(destination));
        return trip;
    }

    @Test
    void casesAreFilteredByTheirLiveTripsDriverCarrierAndPlaces() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        UUID carrierA = UUID.randomUUID();
        UUID carrierB = UUID.randomUUID();
        PgIds.query(pool, "INSERT INTO miot_fleet.carrier (id, tenant_code, rut, legal_name) VALUES ($1, $2, $3, 'A')"
                + ", ($4, $2, $5, 'B'), ($6, 'other-' || $2, $3, 'C')", Tuple.tuple().addUUID(carrierA)
                .addString(tenant).addString("76.111.111-1").addUUID(carrierB).addString("77222222-2")
                .addUUID(UUID.randomUUID()));
        UUID tripA = liveTrip(tenant, "12.345.678-9", "9876543-k", carrierA, "Planta Norte", "Puerto Sur");
        UUID tripB = liveTrip(tenant, "11111111-1", null, carrierB, "Planta Sur", "Puerto Norte");
        Instant t0 = Instant.parse("2026-10-22T03:00:00Z");
        long a = log.append(tenant, List.of(t(Kind.OPENED, speeding, t0, 3, 0)),
                new TransitionLog.Place(tripA.toString(), null, null, null, null)).get(0).caseId();
        long b = log.append(tenant, List.of(new Transition(Kind.OPENED, speeding, "1.0.0", SymptomState.ACTIVE,
                "DEMO02", t0.plusSeconds(10), 2, 0, 30)), new TransitionLog.Place(tripB.toString(), null, null, null,
                        null)).get(0).caseId();
        log.append(tenant, List.of(new Transition(Kind.OPENED, speeding, "1.0.0", SymptomState.ACTIVE, "DEMO03",
                t0.plusSeconds(20), 2, 0, 30)), new TransitionLog.Place("legacy-trip", null, null, null, null));
        PgEngineCases cases = new PgEngineCases(() -> pool);

        assertEquals(List.of(a), ids(cases.list(tenant, byTrip("12345678-9", null, null, null))), "first driver");
        assertEquals(List.of(a), ids(cases.list(tenant, byTrip("9.876.543-K", null, null, null))), "second driver");
        assertEquals(List.of(a), ids(cases.list(tenant, byTrip(null, "76111111-1", null, null))), "carrier RUT");
        assertEquals(List.of(b), ids(cases.list(tenant, byTrip(null, "77.222.222-2", null, null))));
        assertEquals(List.of(b), ids(cases.list(tenant, byTrip(null, carrierB.toString(), null, null))),
                "carrier id");
        assertEquals(List.of(a), ids(cases.list(tenant, byTrip(null, null, " planta NORTE ", null))));
        assertEquals(List.of(b), ids(cases.list(tenant, byTrip(null, null, "Planta Sur", "puerto norte"))));
        assertTrue(cases.list(tenant, byTrip(null, null, "Planta", null)).isEmpty(), "the whole name");
        assertTrue(cases.list(tenant, byTrip("12345678-9", "77222222-2", null, null)).isEmpty());
        assertTrue(cases.list(tenant, byTrip(null, "78333333-3", null, null)).isEmpty());
        assertTrue(cases.list(tenant, byTrip("--", null, null, null)).isEmpty(), "nothing left to compare");
        assertTrue(cases.list("other-" + tenant, byTrip(null, "76111111-1", null, null)).isEmpty());

        List<EngineCase> all = cases.list(tenant, EngineCaseStore.CaseFilter.OPEN);
        assertEquals(3, all.size(), "a case without a live trip still lists");
        EngineCase.TripDetails details = all.stream().filter(c -> c.id() == a).findFirst().orElseThrow().trip();
        assertEquals(new EngineCase.TripDetails("Driver 12.345.678-9", "Carrier", "Planta Norte", "Puerto Sur"),
                details);
        assertNull(all.get(0).trip(), "no live trip");

        PgIds.query(pool, """
                INSERT INTO miot_symptoms.treatment (tenant_code, symptom_id, type)
                VALUES ($1, $2, 'CALL')
                """, Tuple.of(tenant, -a));
        assertEquals(List.of(a), ids(cases.list(tenant,
                byTrip(null, "76111111-1", null, null).withOpenTreatment())));
        assertTrue(cases.list(tenant, byTrip(null, "77222222-2", null, null).withOpenTreatment()).isEmpty());
    }

    @Test
    void tripFiltersNeverReadAnotherTenantsTripOrCarrier() {
        String tenant = "tenant-" + UUID.randomUUID();
        String other = "other-" + tenant;
        UUID speeding = symptom(tenant);
        UUID carrier = UUID.randomUUID();
        PgIds.query(pool, """
                INSERT INTO miot_fleet.carrier (id, tenant_code, rut, legal_name)
                VALUES ($1, $2, '76.111.111-1', 'Demo carrier')
                """, Tuple.of(carrier, other));
        UUID foreign = liveTrip(other, "12.345.678-9", null, carrier, "Foreign origin", "Destination");
        UUID own = liveTrip(tenant, "11.111.111-1", null, carrier, "Own origin", "Destination");
        Instant at = Instant.parse("2026-10-22T03:00:00Z");
        long foreignCase = log.append(tenant, List.of(t(Kind.OPENED, speeding, at, 3, 0)),
                new TransitionLog.Place(foreign.toString(), null, null, null, null)).get(0).caseId();
        log.append(tenant, List.of(new Transition(Kind.OPENED, speeding, "1.0.0", SymptomState.ACTIVE,
                "demo-other", at.plusSeconds(1), 2, 0, 30)),
                new TransitionLog.Place(own.toString(), null, null, null, null));
        PgEngineCases cases = new PgEngineCases(() -> pool);

        assertTrue(cases.list(tenant, byTrip("12345678-9", null, null, null)).isEmpty());
        assertTrue(cases.list(tenant, byTrip(null, null, "Foreign origin", null)).isEmpty());
        assertTrue(cases.list(tenant, byTrip(null, "76111111-1", null, null)).isEmpty());
        assertNull(cases.find(tenant, foreignCase).orElseThrow().trip(), "foreign trip names are not exposed");
        assertEquals(2, cases.list(tenant, EngineCaseStore.CaseFilter.OPEN).size());
    }

    private static EngineCaseStore.CaseFilter byTrip(String driver, String carrier, String origin,
            String destination) {
        return new EngineCaseStore.CaseFilter(null, null, null, null, null, null, driver, carrier, origin,
                destination);
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

    @Test
    void treatedCasesAreFilteredBeforeTheTwoHundredRowLimit() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        Instant at = Instant.parse("2026-10-22T03:00:00Z");
        TransitionLog.Place place = new TransitionLog.Place(null, null, null, null, null);
        long treated = log.append(tenant, List.of(t(Kind.OPENED, speeding, at, 3, 0)), place).get(0).caseId();
        PgIds.query(pool, """
                INSERT INTO miot_symptoms.treatment (tenant_code, symptom_id, type, opened_by)
                VALUES ($1, $2, 'CALL', 'operator@example.com')
                """, Tuple.of(tenant, -treated));
        List<Transition> newer = new ArrayList<>();
        for (int i = 1; i <= 201; i++) {
            newer.add(new Transition(Kind.OPENED, speeding, "1.0.0", SymptomState.ACTIVE, "demo-" + i,
                    at.plusSeconds(i), 4, 0, 30));
        }
        log.append(tenant, newer, place);
        PgEngineCases cases = new PgEngineCases(() -> pool);

        assertEquals(200, cases.list(tenant, EngineCaseStore.CaseFilter.OPEN).size());
        EngineCaseStore.CaseFilter filter = EngineCaseStore.CaseFilter.OPEN.withOpenTreatment();
        assertEquals(List.of(treated), ids(cases.list(tenant, filter)));
        assertTrue(cases.list("other-" + tenant, filter).isEmpty());
    }

    private static List<Long> ids(List<com.microboxlabs.miot.symptoms.cases.EngineCase> found) {
        return found.stream().map(com.microboxlabs.miot.symptoms.cases.EngineCase::id).toList();
    }

    @Test
    void aCaseKeepsTheContextAndRuleOfItsLevel() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID speeding = symptom(tenant);
        Instant t0 = Instant.parse("2026-10-22T03:00:00Z");
        TransitionLog.Place place = new TransitionLog.Place("T-1", -33.4, -70.6, 95.0, null);
        long caseId = log.append(tenant, List.of(t(Kind.OPENED, speeding, t0, 1, 0)), place,
                java.util.Map.of("check", java.util.Map.of("loss", java.util.Map.of("silence_s", 200.0,
                        "last", java.util.Map.of("at", t0.minusSeconds(200).toString())))))
                .get(0).caseId();
        PgEngineCases cases = new PgEngineCases(() -> pool);

        EngineCase opened = cases.find(tenant, caseId).orElseThrow();
        assertEquals(200.0, opened.levelContext().path("check").path("loss").path("silence_s").asDouble());
        assertEquals("true", opened.levelRule());

        log.append(tenant, List.of(t(Kind.LEVEL_CHANGED, speeding, t0.plusSeconds(60), 3, 1)), place,
                java.util.Map.of("check", java.util.Map.of("loss", java.util.Map.of("silence_s", 1900.0,
                        "last", java.util.Map.of("at", t0.plusSeconds(30).toString())))));
        EngineCase rose = cases.find(tenant, caseId).orElseThrow();
        assertEquals(3, rose.level());
        assertEquals(1900.0, rose.levelContext().path("check").path("loss").path("silence_s").asDouble());
        assertEquals(200.0, rose.openingContext().path("check").path("loss").path("silence_s").asDouble(),
                "the opening context stays separate from the latest level context");
        assertEquals(t0.minusSeconds(200).toString(),
                rose.openingContext().path("check").path("loss").path("last").path("at").asText());
        assertEquals(t0.plusSeconds(30).toString(),
                rose.levelContext().path("check").path("loss").path("last").path("at").asText());
        assertEquals(List.of(new EngineCase.LevelStep(t0, 1), new EngineCase.LevelStep(t0.plusSeconds(60), 3)),
                rose.levels());

        log.append(tenant, List.of(t(Kind.LEVEL_CHANGED, speeding, t0.plusSeconds(120), 3, 3)), place);
        assertNull(cases.find(tenant, caseId).orElseThrow().levelContext(), "a change without a context");
    }

    @Test
    void closingContextIsReadWithTheOpeningLevelAndTripMetadataInsideItsTenant() {
        String tenant = "tenant-" + UUID.randomUUID();
        UUID definition = symptom(tenant);
        UUID trip = liveTrip(tenant, "driver-a", null, null, "Origin", "Destination");
        Instant at = Instant.parse("2026-01-01T00:00:00Z");
        TransitionLog.Place place = new TransitionLog.Place(trip.toString(), 0.0, 0.0, 0.0, null);
        long caseId = log.append(tenant, List.of(t(Kind.OPENED, definition, at, 1, 0)), place,
                java.util.Map.of("phase", "opening")).get(0).caseId();
        PgEngineCases cases = new PgEngineCases(() -> pool);
        assertNull(cases.find(tenant, caseId).orElseThrow().closingContext());
        log.append(tenant, List.of(t(Kind.LEVEL_CHANGED, definition, at.plusSeconds(60), 3, 1)), place,
                java.util.Map.of("phase", "level"));
        log.append(tenant, List.of(t(Kind.CLOSED, definition, at.plusSeconds(120), 0, 3)), place,
                java.util.Map.of("phase", "closing"));

        EngineCase closed = cases.find(tenant, caseId).orElseThrow();
        assertEquals("opening", closed.openingContext().path("phase").asText());
        assertEquals("level", closed.levelContext().path("phase").asText());
        assertEquals("closing", closed.closingContext().path("phase").asText());
        assertEquals(at.plusSeconds(120), closed.closedAt());
        assertEquals(3, closed.level());
        assertEquals("Driver driver-a", closed.trip().driver());
        assertEquals("Origin", closed.trip().origin());
        assertTrue(cases.find("other-" + tenant, caseId).isEmpty());

        long next = log.append(tenant, List.of(t(Kind.OPENED, definition, at.plusSeconds(180), 1, 0)), place)
                .get(0).caseId();
        assertTrue(cases.close(tenant, next, "operator@example.com", at.plusSeconds(240)));
        assertNull(cases.find(tenant, next).orElseThrow().closingContext(), "operator close has no check context");
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

package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.CaseFilter;
import io.vertx.pgclient.PgException;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class PgEngineCasesTest {

    private static final CaseFilter TRIP_FILTER = new CaseFilter(null, null, null, null, null, null,
            "12345678-9", null, null, null);

    @Test
    void missingTripTablesAreTheOnlyTripFilterFallback() {
        PgEngineCases cases = new PgEngineCases(() -> {
            throw new PgException("relation does not exist", "ERROR", "42P01", null);
        });

        assertTrue(cases.list("tenant-demo", TRIP_FILTER).isEmpty());
    }

    @Test
    void tripFiltersPropagateDatabaseFailures() {
        for (RuntimeException failure : List.of(new IllegalStateException("database unavailable"),
                new PgException("statement timeout", "ERROR", "57014", null),
                new PgException("permission denied", "ERROR", "42501", null))) {
            PgEngineCases cases = new PgEngineCases(() -> {
                throw failure;
            });

            assertSame(failure, assertThrows(RuntimeException.class,
                    () -> cases.list("tenant-demo", TRIP_FILTER)));
        }
    }

    @Test
    void readsTheFirstMandatesServiceCode() {
        assertEquals("SERVICE-001", PgEngineCases.tripCode("""
                [{"code":" SERVICE-001 "},{"code":"SERVICE-002"}]
                """));
        assertEquals("00123", PgEngineCases.tripCode("[{\"code\":\"00123\"}]"));
        assertEquals("0", PgEngineCases.tripCode("[{\"code\":0}]"));
    }

    @Test
    void readsOnlyValidStringEncodedArrays() throws Exception {
        ObjectMapper json = new ObjectMapper();
        String array = "[{\"code\":\"SERVICE-001\"}]";
        assertEquals("SERVICE-001", PgEngineCases.tripCode(json.writeValueAsString(array)));
        assertNull(PgEngineCases.tripCode(json.writeValueAsString(array + " trailing")));
    }

    @Test
    void aMalformedRowDoesNotHideTheNextRowsCode() {
        List<String> codes = List.of("\"not-json\"", "[{\"code\":\"SERVICE-001\"}]").stream()
                .map(PgEngineCases::tripCode).toList();
        assertEquals(Arrays.asList(null, "SERVICE-001"), codes);
    }

    @Test
    void missingBlankAndMalformedCodesAreOptional() {
        assertNull(PgEngineCases.tripCode(null));
        for (String value : List.of("", " ", "null", "[]", "{}", "[{}]", "[{\"code\":null}]",
                "[{\"code\":\"  \"}]", "[{\"code\":{}}]", "\"\"", "not-json", "\"not-json\"")) {
            assertNull(PgEngineCases.tripCode(value), value);
        }
    }

    @Test
    void aSpeedSymptomsStepsCarryTheKeptLimitOrOneDerivedFromTheMeasure() throws Exception {
        var steps = new ObjectMapper().readTree("""
                [{"at":"2026-01-01T00:00:00+00:00","level":2,"speed_kmh":60.4,"measure":10.0,
                  "speed_limit":{"kmh":50.0,"source":"custom","road_kmh":80.0,"custom_kmh":50.0,"zone_id":3,
                                 "zone_name":"Tramo A"}},
                 {"at":"2026-01-01T00:01:00+00:00","level":4,"speed_kmh":83.6,"measure":24.0,"speed_limit":null},
                 {"at":"2026-01-01T00:02:00+00:00","level":4,"speed_kmh":null,"measure":24.0}]
                """);
        Instant t0 = Instant.parse("2026-01-01T00:00:00Z");
        assertEquals(List.of(
                new EngineCase.LevelStep(t0, 2, 60.0, new EngineCase.SpeedLimit(50, "custom", "Tramo A")),
                new EngineCase.LevelStep(t0.plusSeconds(60), 4, 84.0, new EngineCase.SpeedLimit(60, "custom", null)),
                new EngineCase.LevelStep(t0.plusSeconds(120), 4)), PgEngineCases.steps(steps, "custom"),
                "a change written before the limit was kept: speed minus the measure");
        assertEquals(new EngineCase.SpeedLimit(80, "road", null), PgEngineCases.steps(steps, "road").get(0)
                .speedLimit(), "the limit the measure reads, without the own zone");
        assertEquals(new EngineCase.LevelStep(t0, 2), PgEngineCases.steps(steps, null).get(0),
                "not a speed symptom");
    }

    @Test
    void readsTheLevelStepsAsPostgresWritesThem() throws Exception {
        var steps = new ObjectMapper().readTree("""
                [{"at":"2026-01-01T00:00:00+00:00","level":1},{"at":"bad","level":2},
                 {"at":"2026-01-01T00:30:00-03:00","level":2}]
                """);
        assertEquals(List.of(new EngineCase.LevelStep(Instant.parse("2026-01-01T00:00:00Z"), 1),
                new EngineCase.LevelStep(Instant.parse("2026-01-01T03:30:00Z"), 2)), PgEngineCases.steps(steps));
        assertEquals(List.of(), PgEngineCases.steps(null));
    }
}

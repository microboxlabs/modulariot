package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class PgEngineCasesTest {

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

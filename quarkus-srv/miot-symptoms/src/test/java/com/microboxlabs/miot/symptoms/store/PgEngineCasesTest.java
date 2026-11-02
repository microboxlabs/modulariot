package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.ObjectMapper;
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
}

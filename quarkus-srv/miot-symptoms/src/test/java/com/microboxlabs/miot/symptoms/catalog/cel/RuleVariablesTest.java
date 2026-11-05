package com.microboxlabs.miot.symptoms.catalog.cel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class RuleVariablesTest {

    @Test
    void theCaseSchemaHasEveryCaseVariable() {
        assertEquals(RuleVariables.CASE.size(), RuleSchema.CASE.fields().size());
        RuleVariables.CASE.forEach(v -> assertEquals(v.type(), RuleSchema.CASE.fields().get(v.path())));
        assertEquals("number", RuleSchema.LEVEL_VARIABLES.get("open_s"));
    }

    @Test
    void everyVariableHasBothMeanings() {
        Stream.concat(RuleVariables.CASE.stream(), RuleVariables.LEVEL.stream()).forEach(v -> {
            assertFalse(v.es().isBlank(), v.path());
            assertFalse(v.en().isBlank(), v.path());
        });
    }

    @Test
    void theFieldFollowsTheLocale() {
        RuleVariables.Variable closed = RuleVariables.CASE.stream()
                .filter(v -> v.path().equals("case.closed_on_trip_s")).findFirst().orElseThrow();
        SourceField es = closed.field("es-CL");
        assertTrue(es.label().contains("-1 sin cierre en el viaje"));
        assertEquals("s", es.unit());
        assertEquals("number", es.type());
        assertTrue(closed.field("en").label().startsWith("seconds since"));
        assertEquals(closed.es(), closed.label(null));
    }

    @Test
    void aVariableWithoutUnitHasNone() {
        assertNull(RuleVariables.LEVEL.getFirst().field("es").unit());
        assertEquals("measure", RuleVariables.LEVEL.getFirst().path());
    }
}

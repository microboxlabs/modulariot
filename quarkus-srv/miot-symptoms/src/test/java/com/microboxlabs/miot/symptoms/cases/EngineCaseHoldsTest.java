package com.microboxlabs.miot.symptoms.cases;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.dto.TreatmentView;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** How the tower shows a held case: its list row, the counts, the Ignorados filter and the timeline. */
class EngineCaseHoldsTest {

    private static final String TENANT = "tenant-a";
    private static final Instant NOW = Instant.parse("2026-11-03T12:00:00Z");
    private static final UUID SPEEDING = UUID.randomUUID();

    private final InMemoryEngineCases store = new InMemoryEngineCases() {
        @Override
        public long ignoredCount(String tenantCode) {
            return 2;
        }
    };
    private final EngineCaseService service = new EngineCaseService(store, (t, a, d) -> { }, t -> null,
            Clock.fixed(NOW, ZoneOffset.UTC));

    private EngineCase engineCase(long id) {
        return new EngineCase(id, SPEEDING, "1.0.0", "Exceso", "speed", "DEMO01", NOW.minusSeconds(600), 3, null,
                null, null, null, null, 0, null, null, null);
    }

    @Test
    void theIgnoredCodeFiltersTheHeldCases() {
        EngineCaseStore.CaseFilter f = EngineCaseService.filter(Map.of("p_icu_code",
                String.valueOf(EngineCaseService.IGNORED_CODE)));
        assertTrue(f.ignoredOnly());
        assertEquals(null, f.level());
        assertFalse(EngineCaseService.filter(Map.of("p_icu_code", "3")).ignoredOnly());
    }

    @Test
    void aHeldCaseRowSaysUntilWhenAndAReturnedOneSaysSo() {
        store.add(engineCase(1).withHold(new EngineCase.Ignored("h-1", NOW.minusSeconds(60), NOW.plusSeconds(240),
                false, "CASE", "ops@example.com"), null));
        store.add(engineCase(2).withHold(null, NOW.minusSeconds(30)));

        JsonNode page = service.casesPage(TENANT, Map.of());
        JsonNode held = page.path("data").get(1);
        JsonNode back = page.path("data").get(0);
        if (held.path("id").asLong() != -1) {
            JsonNode swap = held;
            held = back;
            back = swap;
        }

        assertEquals("h-1", held.path("ignored").path("treatment_id").asText());
        assertEquals(NOW.plusSeconds(240).toString(), held.path("ignored").path("until").asText());
        assertFalse(held.path("ignored").path("until_trip_end").asBoolean());
        assertTrue(held.path("returned_after_ignore_at").isMissingNode());
        assertEquals(NOW.minusSeconds(30).toString(), back.path("returned_after_ignore_at").asText());
        assertTrue(back.path("ignored").isMissingNode());
    }

    @Test
    void theCountsCarryTheIgnoredCases() {
        JsonNode counts = service.withOpenCaseCounts(TENANT, JsonNodeFactory.instance.objectNode());
        assertEquals(2, counts.path("Ignored").asLong());
    }

    @Test
    void theTimelineMarksTheHoldAndItsEnd() {
        OffsetDateTime at = NOW.minusSeconds(600).atOffset(ZoneOffset.UTC);
        TreatmentAction ignore = new TreatmentAction("a", "t", TENANT, 1, ActionKind.IGNORE, null, null, null, null,
                null, "ignore_reason_2", "Zona de sombra GPS conocida", null, 300, null, "animal en la ruta",
                List.of(), Map.of("scope", "CASE", "until_trip_end", false), "ops@example.com", at);
        TreatmentView hold = new TreatmentView("t", -1, "DEMO01", null, TreatmentType.IGNORE_CONDITION,
                TreatmentStatus.CLOSED, "ops@example.com", at, "system", at.plusSeconds(300),
                HoldService.RETURNED, null, at.plusSeconds(300), List.of(ignore));
        JsonNode header = JsonNodeFactory.instance.objectNode().set("timeline", JsonNodeFactory.instance.arrayNode()
                .add(JsonNodeFactory.instance.objectNode().set("conditions_agg", JsonNodeFactory.instance.arrayNode()
                        .add(JsonNodeFactory.instance.objectNode()))));

        JsonNode rows = EngineCaseService.withTreatments(header, List.of(hold)).path("timeline").get(0)
                .path("conditions_agg").get(0).path("treatments");

        assertEquals(2, rows.size());
        assertEquals("ignorar condicion", rows.get(0).path("treatment_type").asText());
        assertEquals(at.toInstant().plusSeconds(300).toString(), rows.get(0).path("ignored_until").asText());
        assertEquals("CASE", rows.get(0).path("scope").asText());
        assertEquals("fin de ignorar", rows.get(1).path("treatment_type").asText());
        assertEquals(HoldService.RETURNED, rows.get(1).path("resolution").asText());
        assertEquals("system", rows.get(1).path("by").asText());
    }
}

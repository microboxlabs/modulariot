package com.microboxlabs.miot.symptoms.cases;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EngineCaseServiceTest {

    private static final String TENANT = "tenant-demo";
    private static final Instant OPENED = Instant.parse("2026-10-22T03:00:00Z");
    private static final UUID PANIC = UUID.randomUUID();

    private final InMemoryEngineCases store = new InMemoryEngineCases();
    private final List<String> forgotten = new ArrayList<>();
    private final EngineCaseService service = new EngineCaseService(store,
            (tenant, asset, definition) -> forgotten.add(asset + "/" + definition), t -> null,
            Clock.fixed(OPENED.plusSeconds(90), ZoneOffset.UTC));

    private static EngineCase panic(long id, String asset) {
        return engineCase(id, asset, 4, 0);
    }

    private static EngineCase engineCase(long id, String asset, int level, long treatments) {
        return new EngineCase(id, PANIC, "0.1.0", "Botón de pánico", "emergencies", asset, OPENED, level, "T-1",
                -33.4489, -70.6693, 0.0, null, treatments, 2, 1L);
    }

    @Test
    void openCasesGoFirstOnTheFirstPage() throws Exception {
        store.add(panic(12, "DEMO01"));
        JsonNode page = new ObjectMapper().readTree("""
                {"data":[{"id":991,"asset_id":"GPS01"}],"page":1,"page_size":10,"total_rows":1,"total_pages":1}
                """);

        JsonNode out = service.withOpenCases(TENANT, page);

        assertEquals(2, out.path("data").size());
        JsonNode row = out.path("data").get(0);
        assertEquals(-12, row.path("id").asLong());
        assertEquals("CODE BLACK", row.path("icu_condition").asText());
        assertEquals("4", row.path("icu_code").asText());
        assertEquals("DEMO01", row.path("asset_id").asText());
        assertEquals(90, row.path("duration_sec").asLong());
        assertEquals(2, row.path("sla_minutes").asInt());
        assertEquals(1, row.path("recurrence_events").asInt());
        assertEquals(991, out.path("data").get(1).path("id").asLong());
        assertEquals(1, out.path("total_rows").asInt(), "the GPS totals still page");
        assertEquals(1, out.path("open_cases").asInt());
    }

    @Test
    void aCaseWithAnOpenTreatmentIsUnderTreatment() {
        store.add(engineCase(12, "DEMO01", 4, 1));

        JsonNode row = service.withOpenCases(TENANT, null).path("data").get(0);

        assertEquals("UNDER TREATMENT", row.path("icu_condition").asText());
        assertEquals("4", row.path("icu_code").asText());
    }

    @Test
    void openCasesAddToTheGpsCountsOnceEach() throws Exception {
        store.add(engineCase(12, "DEMO01", 4, 0));
        store.add(engineCase(13, "DEMO02", 4, 0));
        store.add(engineCase(14, "DEMO03", 3, 0));
        store.add(engineCase(15, "DEMO04", 1, 0));
        store.add(engineCase(16, "DEMO05", 4, 2));
        JsonNode gps = new ObjectMapper().readTree("""
                {"Code Black":1,"Under Treatment":4,"Stable":7}
                """);

        JsonNode out = service.withOpenCaseCounts(TENANT, gps);

        assertEquals(3, out.path("Code Black").asInt());
        assertEquals(1, out.path("Critical condition").asInt());
        assertEquals(1, out.path("Under Observation").asInt());
        assertEquals(5, out.path("Under Treatment").asInt());
        assertEquals(7, out.path("Stable").asInt());
        assertFalse(out.has("Compromised condition"));
        assertEquals(1, gps.path("Code Black").asInt(), "the cached GPS answer is not changed");
    }

    @Test
    void countsEveryOpenCaseBeyondAPageOfThem() {
        for (long id = 1; id <= 201; id++) {
            store.add(engineCase(id, "DEMO" + id, 4, 0));
        }
        store.add(engineCase(300, "DEMO300", 2, 0));

        JsonNode out = service.withOpenCaseCounts(TENANT, null);

        assertEquals(201, out.path("Code Black").asInt());
        assertEquals(1, out.path("Compromised condition").asInt());
    }

    @Test
    void openCasesCountWithoutTheGpsCounts() {
        store.add(panic(12, "DEMO01"));

        assertEquals(1, service.withOpenCaseCounts(TENANT, null).path("Code Black").asInt());
    }

    @Test
    void closedCasesAreNotCounted() {
        store.add(panic(12, "DEMO01"));
        service.close(TENANT, -12, "operator@example.com");

        assertTrue(service.withOpenCaseCounts(TENANT, null).isEmpty());
    }

    @Test
    void showsTheCasesWithoutTheGpsPage() {
        store.add(panic(12, "DEMO01"));

        JsonNode out = service.withOpenCases(TENANT, null);

        assertEquals(1, out.path("data").size());
        assertEquals(1, out.path("page").asInt());
    }

    @Test
    void onlyPagingRequestsShowTheOpenCases() {
        assertTrue(EngineCaseService.showsOpenCases(Map.of()));
        assertTrue(EngineCaseService.showsOpenCases(Map.of("p_page", "1", "p_page_size", "20")));
        assertFalse(EngineCaseService.showsOpenCases(Map.of("p_page", "2")));
        assertFalse(EngineCaseService.showsOpenCases(Map.of("p_asset_id", "DEMO01")));
    }

    @Test
    void theHeaderAndTheSignalsDescribeTheCase() {
        store.add(panic(12, "DEMO01"));

        JsonNode header = service.header(TENANT, -12);
        assertEquals("Botón de pánico", header.path("symptom_info").path("name").asText());
        assertEquals(4, header.path("symptom_info").path("icu_code").asInt());
        assertEquals("T-1", header.path("trip_info").path("trip_id").asText());
        JsonNode agg = header.path("timeline").get(0).path("conditions_agg").get(0);
        assertEquals(-12, agg.path("symptom_id").asLong(), "the map selects the case to load its point");
        assertEquals("Botón de pánico", agg.path("type").asText());

        JsonNode signals = service.signals(TENANT, -12);
        assertEquals(EngineCaseService.ewkbPoint(-70.6693, -33.4489),
                signals.path("features").get(0).path("geometry").asText());
        assertThrows(NoSuchElementException.class, () -> service.header(TENANT, 12), "a GPS database id");
        assertThrows(NoSuchElementException.class, () -> service.header(TENANT, -99));
    }

    @Test
    void closingTheCaseDropsItsEpisodeOnce() {
        store.add(panic(12, "DEMO01"));

        service.close(TENANT, -12, "operator@example.com");
        service.close(TENANT, -12, "operator@example.com");

        assertEquals(List.of("operator@example.com"), store.closedBy);
        assertEquals(List.of("DEMO01/" + PANIC), forgotten);
        assertTrue(store.open(TENANT).isEmpty());
    }

    @Test
    void aFailedEpisodeDropLeavesTheCaseOpenForARetry() {
        store.add(panic(12, "DEMO01"));
        boolean[] down = {true};
        EngineCaseService flaky = new EngineCaseService(store, (tenant, asset, definition) -> {
            if (down[0]) {
                throw new IllegalStateException("redis timeout");
            }
            forgotten.add(asset + "/" + definition);
        }, t -> null, Clock.fixed(OPENED.plusSeconds(90), ZoneOffset.UTC));

        assertThrows(IllegalStateException.class, () -> flaky.close(TENANT, -12, "operator@example.com"));
        assertFalse(store.open(TENANT).isEmpty());

        down[0] = false;
        flaky.close(TENANT, -12, "operator@example.com");

        assertEquals(List.of("DEMO01/" + PANIC), forgotten);
        assertTrue(store.open(TENANT).isEmpty());
    }

    @Test
    void theHeaderAnswersWhenTheTripCannotBeRead() {
        store.add(panic(12, "DEMO01"));
        EngineCaseService gpsDown = new EngineCaseService(store, (tenant, asset, definition) -> {
        }, t -> {
            throw new IllegalStateException("GPS database down");
        }, Clock.fixed(OPENED.plusSeconds(90), ZoneOffset.UTC));

        JsonNode header = gpsDown.header(TENANT, -12);

        assertEquals("T-1", header.path("trip_info").path("trip_id").asText());
        assertFalse(header.path("trip_info").has("carrier"));
    }

    @Test
    void writesAnEwkbPointAsPostgis() {
        assertEquals("0101000020E6100000000000000000F03F0000000000000040", EngineCaseService.ewkbPoint(1, 2));
    }
}

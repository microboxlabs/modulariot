package com.microboxlabs.miot.symptoms.cases;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.events.SymptomCaseData;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;

class EngineCaseServiceTest {

    private static final String TENANT = "tenant-demo";
    private static final Instant OPENED = Instant.parse("2026-10-22T03:00:00Z");
    private static final UUID PANIC = UUID.randomUUID();

    private final InMemoryEngineCases store = new InMemoryEngineCases();
    private final List<String> forgotten = new ArrayList<>();
    private final List<OperationalEvent> fired = new ArrayList<>();
    private final EngineCaseService service = new EngineCaseService(store,
            (tenant, asset, definition) -> forgotten.add(asset + "/" + definition), t -> null,
            Clock.fixed(OPENED.plusSeconds(90), ZoneOffset.UTC), new SymptomEvents(e -> {
                fired.add(e);
                return CompletableFuture.completedFuture(e);
            }, (tenant, id) -> Optional.of(definition(id)), Clock.systemUTC()));

    private static SymptomDefinition definition(UUID id) {
        return new SymptomDefinition(id, TENANT, "panic-button", "Botón de pánico", "emergencies", null, null,
                "gps_signal", null, null, null, null, SymptomState.ACTIVE, "0.1.0", "t", null, "t", null);
    }

    private static EngineCase panic(long id, String asset) {
        return engineCase(id, asset, 4, 0);
    }

    private static EngineCase engineCase(long id, String asset, int level, long treatments) {
        return new EngineCase(id, PANIC, "0.1.0", "Botón de pánico", "emergencies", asset, OPENED, level, "T-1",
                -33.4489, -70.6693, 0.0, null, treatments, 2, 1L);
    }

    private static EngineCase at(long id, String asset, Instant opened, Instant closed) {
        return new EngineCase(id, PANIC, "0.1.0", "Botón de pánico", "emergencies", asset, opened, 4, null,
                -33.4489, -70.6693, 0.0, closed, 0, 2, null);
    }

    @Test
    void theSignalWindowRunsFromAnHourBeforeTheCaseUntilNow() {
        store.add(at(12, "DEMO01", OPENED, null));

        EngineCaseService.SignalWindow w = service.signalWindow(TENANT, -12);

        assertEquals("DEMO01", w.assetId());
        assertEquals(OPENED.minusSeconds(3600), w.from());
        assertEquals(OPENED.plusSeconds(90), w.to());
    }

    @Test
    void theSignalWindowStartsAtTheVehiclesPreviousCaseWhenNearer() {
        store.add(at(10, "DEMO01", OPENED.minusSeconds(1200), OPENED.minusSeconds(600)));
        store.add(at(11, "DEMO02", OPENED.minusSeconds(300), null));
        store.add(at(12, "DEMO01", OPENED, null));
        store.add(at(13, "DEMO01", OPENED, OPENED.plusSeconds(30)));

        EngineCaseService.SignalWindow w = service.signalWindow(TENANT, -13);

        assertEquals(OPENED.minusSeconds(1200), w.from(),
                "neither the other vehicle's case nor one opened on the same frame counts");
        assertEquals(OPENED.plusSeconds(30), w.to(), "a closed case ends at its close");
    }

    @Test
    void theSignalWindowOfALongCaseIsCapped() {
        Instant opened = OPENED.minus(java.time.Duration.ofDays(10));
        store.add(at(12, "DEMO01", opened, null));

        EngineCaseService.SignalWindow w = service.signalWindow(TENANT, -12);

        assertEquals(opened.plus(EngineCaseService.SIGNALS_AT_MOST), w.to());
        assertThrows(NoSuchElementException.class, () -> service.signalWindow(TENANT, -99));
    }

    @Test
    void openCasesGoFirstOnTheFirstPage() throws Exception {
        store.add(panic(12, "DEMO01"));
        JsonNode page = new ObjectMapper().readTree("""
                {"data":[{"id":991,"asset_id":"GPS01"}],"page":1,"page_size":10,"total_rows":1,"total_pages":1}
                """);

        JsonNode out = service.withCases(TENANT, Map.of(), page);

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
        assertEquals(1, out.path("engine_cases").asInt());
    }

    @Test
    void aCaseWithAnOpenTreatmentIsUnderTreatment() {
        store.add(engineCase(12, "DEMO01", 4, 1));

        JsonNode row = service.withCases(TENANT, Map.of(), null).path("data").get(0);

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
    void theGpsCountsStandWhenTheOpenCasesCannotBeRead() throws Exception {
        store.down = true;
        JsonNode gps = new ObjectMapper().readTree("""
                {"Code Black":1}
                """);

        assertEquals(1, service.withOpenCaseCounts(TENANT, gps).path("Code Black").asInt());
        assertThrows(IllegalStateException.class, () -> service.withOpenCaseCounts(TENANT, null));
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

        JsonNode out = service.withCases(TENANT, Map.of(), null);

        assertEquals(1, out.path("data").size());
        assertEquals(1, out.path("page").asInt());
    }

    @Test
    void theFirstPageShowsTheCasesUnlessAFilterTheyCannotAnswerIsSet() {
        assertTrue(EngineCaseService.showsCases(Map.of()));
        assertTrue(EngineCaseService.showsCases(Map.of("p_page", "1", "p_page_size", "20")));
        assertTrue(EngineCaseService.showsCases(Map.of("p_asset_id", "DEMO01", "p_trip_id", "T-1",
                "p_symptom_name", "Botón de pánico", "p_icu_code", "4",
                "p_start_date_historic", "2026-10-22T00:00:00Z", "p_end_date_historic", "2026-10-23T00:00:00Z")));
        assertTrue(EngineCaseService.showsCases(Map.of("p_driver_id", " ")), "a blank filter is no filter");
        assertFalse(EngineCaseService.showsCases(Map.of("p_page", "2")));
        for (String other : List.of("p_driver_id", "p_carrier_id", "p_origin", "p_destination")) {
            assertFalse(EngineCaseService.showsCases(Map.of(other, "x")), other);
        }
    }

    @Test
    void engineNamesJoinTheLegacySelectorWithoutDuplicates() throws Exception {
        store.add(panic(12, "DEMO01"));
        JsonNode gps = new com.fasterxml.jackson.databind.ObjectMapper().readTree("{\"page\":1,\"data\":[],\"symptom_name_list\":[\"Legacy\",\"Botón de pánico\"]}");
        JsonNode combined = service.withCases(TENANT, Map.of(), gps);
        assertEquals(List.of("Legacy", "Botón de pánico"), names(combined));
        assertEquals(List.of("Botón de pánico"), names(service.withCases(TENANT, Map.of(), null)));
    }

    private static List<String> names(JsonNode page) {
        List<String> out = new ArrayList<>();
        page.path("symptom_name_list").forEach(n -> out.add(n.asText()));
        return out;
    }

    @Test
    void readsTheListFiltersAsACaseFilter() {
        EngineCaseStore.CaseFilter f = EngineCaseService.filter(Map.of("p_trip_id", " T-1 ", "p_asset_id", "DEMO",
                "p_icu_code", "4", "p_start_date_historic", "2026-10-22T03:00:00",
                "p_end_date_historic", "2026-10-23"));

        assertEquals(new EngineCaseStore.CaseFilter("T-1", "DEMO", null, 4, OPENED,
                Instant.parse("2026-10-23T00:00:00Z")), f);
        assertFalse(f.openOnly());
        assertTrue(EngineCaseService.filter(Map.of()).openOnly());
        Map<String, String> badLevel = Map.of("p_icu_code", "x");
        Map<String, String> badDate = Map.of("p_start_date_historic", "ayer");
        assertThrows(IllegalArgumentException.class, () -> EngineCaseService.filter(badLevel));
        assertThrows(IllegalArgumentException.class, () -> EngineCaseService.filter(badDate));
    }

    @Test
    void aTripsCasesOpenAndClosedComeWithADateRange() {
        store.add(engineCase(12, "DEMO01", 4, 0));
        store.add(new EngineCase(13, PANIC, "0.1.0", "Botón de pánico", "emergencies", "DEMO01",
                OPENED.plusSeconds(30), 2, "T-1", null, null, null, OPENED.plusSeconds(60), 0, null, 0L));
        store.add(new EngineCase(14, PANIC, "0.1.0", "Botón de pánico", "emergencies", "DEMO02", OPENED, 4,
                "T-2", null, null, null, null, 0, null, 0L));

        JsonNode open = service.withCases(TENANT, Map.of("p_trip_id", "T-1"), null);
        JsonNode all = service.withCases(TENANT, Map.of("p_trip_id", "T-1",
                "p_start_date_historic", "2026-10-22T00:00:00Z", "p_end_date_historic", "2026-10-23T00:00:00Z"),
                null);

        assertEquals(List.of(-12L), ids(open), "without dates, the open ones");
        assertEquals(List.of(-13L, -12L), ids(all), "the latest first");
        JsonNode closed = all.path("data").get(0);
        assertEquals(OPENED.plusSeconds(60).toString(), closed.path("end_time").asText());
        assertEquals(30, closed.path("duration_sec").asLong(), "until it closed");
        assertFalse(all.path("data").get(1).has("end_time"));
    }

    private static List<Long> ids(JsonNode page) {
        List<Long> out = new ArrayList<>();
        page.path("data").forEach(r -> out.add(r.path("id").asLong()));
        return out;
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
    void closingTheCasePublishesItsCloseOnce() {
        store.add(panic(12, "DEMO01"));

        service.close(TENANT, -12, "operator@example.com");
        service.close(TENANT, -12, "operator@example.com");

        assertEquals(1, fired.size());
        OperationalEvent e = fired.get(0);
        assertEquals("symptom.case.closed", e.type());
        assertEquals("-12", e.context().key());
        assertEquals(OPENED.plusSeconds(90), e.at());
        assertFalse(e.test());
        SymptomCaseData data = (SymptomCaseData) e.data();
        assertEquals("operator@example.com", data.closedBy());
        assertEquals("panic-button", data.symptomKey());
        assertEquals("Botón de pánico", data.symptomName());
        assertEquals(null, data.driverId());
        assertEquals(PANIC, data.definitionId());
        assertEquals(4, data.level());
        assertEquals("T-1", data.tripId());
    }

    @Test
    void overlappingClosesPublishOnce() {
        EngineCase open = panic(12, "DEMO01");
        // Both requests read the case open before either writes its close.
        InMemoryEngineCases racing = new InMemoryEngineCases() {
            @Override
            public Optional<EngineCase> find(String tenantCode, long caseId) {
                return Optional.of(open);
            }
        };
        racing.add(open);
        EngineCaseService a = new EngineCaseService(racing, (tenant, asset, definition) -> {
        }, t -> null, Clock.fixed(OPENED.plusSeconds(90), ZoneOffset.UTC), new SymptomEvents(e -> {
            fired.add(e);
            return CompletableFuture.completedFuture(e);
        }));

        a.close(TENANT, -12, "first@example.com");
        a.close(TENANT, -12, "second@example.com");

        assertEquals(List.of("first@example.com"), racing.closedBy);
        assertEquals(1, fired.size());
        assertEquals("first@example.com", ((SymptomCaseData) fired.get(0).data()).closedBy());
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
            throw new IllegalStateException("database down");
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

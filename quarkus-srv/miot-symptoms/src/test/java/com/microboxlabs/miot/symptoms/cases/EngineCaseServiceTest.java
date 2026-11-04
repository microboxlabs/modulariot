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
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import com.microboxlabs.miot.symptoms.dto.TreatmentView;
import com.microboxlabs.miot.symptoms.events.SymptomCaseData;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
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
    void engineOnlyPagingAcceptsLargeSizesAndPagesWithoutWrapping() {
        store.add(panic(12, "vehicle-demo"));
        store.add(panic(13, "vehicle-other"));

        JsonNode page = service.casesPage(TENANT, Map.of("p_page_size", "2147483647"));
        assertEquals(2, page.path("data").size());
        assertEquals(1, page.path("total_pages").asInt());
        assertEquals(0, service.casesPage(TENANT,
                Map.of("p_page", "2147483647", "p_page_size", "2147483647")).path("data").size());
    }

    @Test
    void engineOnlyConditionSixListsOpenTreatmentsBeforeThePageLimit() {
        store.add(engineCase(1, "treated-demo", 3, 1));
        for (int id = 2; id <= 202; id++) {
            store.add(at(id, "demo-" + id, OPENED.plusSeconds(id), null));
        }

        JsonNode page = service.casesPage(TENANT, Map.of("p_icu_code", "6"));

        assertEquals(List.of(-1L), ids(page));
        assertEquals("UNDER TREATMENT", page.path("data").get(0).path("icu_condition").asText());
        assertEquals(1, page.path("total_rows").asInt());
        assertEquals(1, service.caseCounts(TENANT, null, null).path("Under Treatment").asInt());
        assertEquals(6, EngineCaseService.filter(Map.of("p_icu_code", "6")).level(),
                "the legacy list's severity filter is unchanged");
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
    void theListAndHeaderExposeTheServiceCodeAndKeepTheTripUuid() throws Exception {
        String tripId = UUID.randomUUID().toString();
        store.add(new EngineCase(12, PANIC, "0.1.0", "Demo symptom", "demo", "vehicle-demo", OPENED, 1,
                tripId, null, null, null, null, 0, null, null, "SERVICE-001"));
        JsonNode legacy = new ObjectMapper().readTree("""
                {"data":[{"id":991,"trip_id":"12345"}]}
                """);

        JsonNode page = service.withCases(TENANT, Map.of(), legacy);
        JsonNode row = page.path("data").get(0);
        JsonNode trip = service.header(TENANT, -12).path("trip_info");

        assertEquals(tripId, row.path("trip_id").asText());
        assertEquals("SERVICE-001", row.path("trip_code").asText());
        assertEquals(tripId, trip.path("trip_id").asText());
        assertEquals("SERVICE-001", trip.path("trip_code").asText());
        assertEquals(legacy.path("data").get(0), page.path("data").get(1));
    }

    @Test
    void aMissingServiceCodeKeepsTheTripIdAvailable() {
        store.add(panic(12, "vehicle-demo"));

        JsonNode row = service.withCases(TENANT, Map.of(), null).path("data").get(0);
        JsonNode trip = service.header(TENANT, -12).path("trip_info");

        assertEquals("T-1", row.path("trip_id").asText());
        assertTrue(row.path("trip_code").isNull());
        assertEquals("T-1", trip.path("trip_id").asText());
        assertTrue(trip.path("trip_code").isNull());
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
    void readsTheTripFiltersAsACaseFilter() {
        EngineCaseStore.CaseFilter f = EngineCaseService.filter(Map.of("p_driver_id", " 12.345.678-9 ",
                "p_carrier_id", "76.111.111-1", "p_origin", "Planta Norte", "p_destination", " "));

        assertEquals(new EngineCaseStore.CaseFilter(null, null, null, null, null, null, "12.345.678-9",
                "76.111.111-1", "Planta Norte", null), f);
        assertTrue(f.byTrip());
        assertFalse(EngineCaseService.filter(Map.of("p_trip_id", "T-1")).byTrip());
    }

    @Test
    void theEngineOnlyPageAppliesTheTripFiltersAndNamesTheTrip() {
        store.trips.put("T-1", new InMemoryEngineCases.Trip("12.345.678-9", null, "c-1", "76.111.111-1", "Norte",
                "Sur"));
        store.add(new EngineCase(12, PANIC, "0.1.0", "Botón de pánico", "emergencies", "DEMO01", OPENED, 4, "T-1",
                null, null, null, null, 0, null, 0L, null).withTrip(new EngineCase.TripDetails("Driver", "Carrier",
                        "Norte", "Sur")));
        store.add(new EngineCase(13, PANIC, "0.1.0", "Botón de pánico", "emergencies", "DEMO02", OPENED, 4, "T-2",
                null, null, null, null, 0, null, 0L));

        JsonNode page = service.casesPage(TENANT, Map.of("p_carrier_id", "76111111-1"));

        assertEquals(List.of(-12L), ids(page));
        assertEquals("Driver", page.get("data").get(0).get("driver").asText());
        assertEquals("Sur", page.get("data").get(0).get("destination").asText());
        assertEquals(0, service.casesPage(TENANT, Map.of("p_driver_id", "1-9")).get("total_rows").asInt());
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

    private static EngineCase lostSignal(long id, Instant lostSince, Instant closed) throws Exception {
        JsonNode context = new ObjectMapper().readTree("""
                {"check": {"signal_lost_minutes": 12.5, "loss": {"silence_s": 750.0, "ratio": 2.5,
                 "low_coverage_zone": true, "cohort_outage": false, "returned": false,
                 "last": {"at": "%s"}}}}
                """.formatted(lostSince));
        return new EngineCase(id, PANIC, "2.1.0", "Pérdida de señal", "signal_continuity", "DEMO01", OPENED, 1,
                "T-1", -33.4489, -70.6693, 0.0, closed, 0, null, 0L, null, context, context,
                "check.loss.silence_s < 1800 || check.loss.low_coverage_zone",
                List.of(new EngineCase.LevelStep(OPENED, 1)));
    }

    @Test
    void anOpenCaseLastsUntilNow() {
        store.add(panic(12, "DEMO01"));

        JsonNode header = service.header(TENANT, -12);

        JsonNode agg = header.path("timeline").get(0).path("conditions_agg").get(0);
        assertEquals(OPENED.toString(), agg.path("start").asText());
        assertEquals(OPENED.plusSeconds(90).toString(), agg.path("end").asText(), "not 0 min: now");
        assertEquals(90, header.path("symptom_info").path("duration_sec").asLong());
        assertEquals(OPENED.plusSeconds(90).toString(),
                service.signals(TENANT, -12).path("description").path("last_signal_timestamp").asText());
    }

    @Test
    void aLostSignalCaseStartsAtTheLastFrameBeforeTheSilence() throws Exception {
        Instant lost = OPENED.minusSeconds(660);
        store.add(lostSignal(12, lost, null));

        JsonNode header = service.header(TENANT, -12);

        JsonNode entry = header.path("timeline").get(0);
        assertEquals(lost.toString(), entry.path("start").asText());
        assertEquals(lost.toString(), entry.path("conditions_agg").get(0).path("start").asText());
        assertEquals(OPENED.toString(), header.path("symptom_info").path("opened_at").asText());
        assertEquals(750, header.path("symptom_info").path("duration_sec").asLong());
        JsonNode signals = service.signals(TENANT, -12);
        assertEquals(lost.toString(), signals.path("description").path("first_signal_timestamp").asText());
        assertEquals(lost.toString(), signals.path("features").get(0).path("properties").path("timestamp").asText());
        assertEquals(1, signals.path("features").get(0).path("properties").path("icu_code").asInt());
        assertEquals(lost.minusSeconds(3600), service.signalWindow(TENANT, -12).from());
    }

    @Test
    void theHeaderSaysWhyTheCaseIsAtItsLevel() throws Exception {
        Instant lost = OPENED.minusSeconds(660);
        store.add(lostSignal(12, lost, OPENED.plusSeconds(30)));

        JsonNode reason = service.header(TENANT, -12).path("level_reason");

        assertEquals(1, reason.path("icu_code").asInt());
        assertEquals("UNDER OBSERVATION", reason.path("icu_condition").asText());
        assertEquals("check.loss.silence_s < 1800 || check.loss.low_coverage_zone", reason.path("rule").asText());
        assertEquals(lost.toString(), reason.path("lost_since").asText());
        assertTrue(reason.path("context").path("check").path("loss").path("low_coverage_zone").asBoolean());
        assertEquals(750.0, reason.path("context").path("check").path("loss").path("silence_s").asDouble());
        assertEquals(OPENED.toString(), reason.path("levels").get(0).path("at").asText());
        assertEquals(1, reason.path("levels").get(0).path("icu_code").asInt());
    }

    @Test
    void aCaseWithoutAKeptContextStillAnswersItsLevel() {
        store.add(panic(12, "DEMO01"));

        JsonNode reason = service.header(TENANT, -12).path("level_reason");

        assertEquals(4, reason.path("icu_code").asInt());
        assertTrue(reason.path("context").isNull());
        assertFalse(reason.has("lost_since"));
    }

    @Test
    void aLostSinceAfterTheOpeningIsIgnored() throws Exception {
        store.add(lostSignal(12, OPENED.plusSeconds(10), null));

        assertEquals(OPENED.toString(), service.header(TENANT, -12).path("timeline").get(0).path("start").asText());
    }

    @Test
    void aLevelChangeOnReturnKeepsTheOriginalSilenceStart() throws Exception {
        Instant lost = OPENED.minusSeconds(660);
        EngineCase opened = lostSignal(12, lost, null);
        JsonNode returned = new ObjectMapper().readTree("""
                {"check":{"loss":{"returned":true,"last":{"at":"%s"}}}}
                """.formatted(OPENED.plusSeconds(60)));
        store.add(opened.withLevel(opened.openingContext(), returned, "check.loss.returned", opened.levels()));

        JsonNode header = service.header(TENANT, -12);

        assertEquals(lost.toString(), header.path("timeline").get(0).path("start").asText());
        assertEquals(lost.toString(), header.path("level_reason").path("lost_since").asText());
        assertTrue(header.path("level_reason").path("context").path("check").path("loss").path("returned").asBoolean());
        assertEquals(750, header.path("symptom_info").path("duration_sec").asLong());
        assertEquals(lost.minusSeconds(3600), service.signalWindow(TENANT, -12).from());
    }

    @Test
    void theHeaderListsTheCaseTreatmentsAndWhenItClosed() {
        Instant closed = OPENED.plusSeconds(600);
        store.add(new EngineCase(12, PANIC, "0.1.0", "Botón de pánico", "emergencies", "DEMO01", OPENED, 4, "T-1",
                null, null, null, closed, 0, null, 0L));
        List<TreatmentView> treatments = List.of(
                treatment(TreatmentStatus.CLOSED, action(ActionKind.CALL, "Juan", "Contestó", "Va en camino"),
                        action(ActionKind.NOTE, null, null, "nota")),
                treatment(TreatmentStatus.CANCELLED, action(ActionKind.CALL, "Pedro", null, null)),
                treatment(TreatmentStatus.CLOSED, action(ActionKind.INVALIDATE, null, "Motivo: prueba", null)));

        JsonNode header = EngineCaseService.withTreatments(service.header(TENANT, -12), treatments);

        JsonNode agg = header.path("timeline").get(0).path("conditions_agg").get(0);
        assertEquals(closed.toString(), agg.path("end").asText());
        assertEquals("operator@example.com", agg.path("assigned_to").asText());
        JsonNode rows = agg.path("treatments");
        assertEquals(2, rows.size(), "notes and cancelled treatments are left out");
        assertEquals("llamar al conductor", rows.get(0).path("treatment_type").asText());
        assertEquals("Llamado a: Juan", rows.get(0).path("description").path("message").asText());
        assertEquals("Contestó · Va en camino", rows.get(0).path("description").path("driver_response").asText());
        assertEquals("invalidar sintoma", rows.get(1).path("treatment_type").asText());
        assertEquals("Motivo: prueba", rows.get(1).path("description").path("message").asText());
    }

    @Test
    void gpsEventNotesLandInTheStepOfTheirFrameBeforeTheTreatments() throws Exception {
        store.add(escalated(OPENED.plusSeconds(10_000)));
        store.notes.put(12L, List.of(
                new EngineCaseStore.CaseNote(OPENED.plusSeconds(3700), "main_power_reconnect",
                        "Alimentación reconectada", OPENED.plusSeconds(3650)),
                new EngineCaseStore.CaseNote(OPENED.plusSeconds(9500), "device_tamper", null,
                        OPENED.plusSeconds(9500))));
        List<TreatmentView> treatments = List.of(treatment(TreatmentStatus.CLOSED,
                actionAt(OPENED.plusSeconds(3800), "En L2")));

        JsonNode aggs = EngineCaseService.withTreatments(service.header(TENANT, -12), treatments)
                .path("timeline").get(0).path("conditions_agg");

        assertEquals(List.of(), messages(aggs.get(0)));
        JsonNode l2 = aggs.get(1).path("treatments");
        assertEquals(2, l2.size());
        assertEquals("evento del gps", l2.get(0).path("treatment_type").asText());
        assertEquals("main_power_reconnect", l2.get(0).path("event_type").asText());
        assertEquals("Alimentación reconectada", l2.get(0).path("description").path("message").asText());
        assertEquals(OPENED.plusSeconds(3650).toString(), l2.get(0).path("at").asText(), "the event's own time");
        assertEquals("llamar al conductor", l2.get(1).path("treatment_type").asText());
        JsonNode l4 = aggs.get(3).path("treatments");
        assertEquals("device_tamper", l4.get(0).path("description").path("message").asText(),
                "without a description the entry shows the event type");
    }

    private static EngineCase escalated(Instant closed) throws Exception {
        EngineCase c = lostSignal(12, OPENED.minusSeconds(600), closed);
        return c.withLevel(c.openingContext(), c.levelContext(), c.levelRule(), List.of(
                new EngineCase.LevelStep(OPENED, 1), new EngineCase.LevelStep(OPENED.plusSeconds(3600), 2),
                new EngineCase.LevelStep(OPENED.plusSeconds(7200), 3),
                new EngineCase.LevelStep(OPENED.plusSeconds(9000), 4)));
    }

    @Test
    void eachLevelStepIsItsOwnTimelineBlock() throws Exception {
        Instant closed = OPENED.plusSeconds(10_000);
        store.add(escalated(closed));

        JsonNode entry = service.header(TENANT, -12).path("timeline").get(0);

        assertEquals(OPENED.minusSeconds(600).toString(), entry.path("start").asText());
        assertEquals(closed.toString(), entry.path("end").asText());
        JsonNode aggs = entry.path("conditions_agg");
        assertEquals(4, aggs.size());
        List<Instant> bounds = List.of(OPENED.minusSeconds(600), OPENED.plusSeconds(3600), OPENED.plusSeconds(7200),
                OPENED.plusSeconds(9000), closed);
        for (int i = 0; i < 4; i++) {
            JsonNode agg = aggs.get(i);
            assertEquals(bounds.get(i).toString(), agg.path("start").asText(), "start of step " + i);
            assertEquals(bounds.get(i + 1).toString(), agg.path("end").asText(), "end of step " + i);
            assertEquals(String.valueOf(i + 1), agg.path("icu_code").asText());
            assertEquals(-12, agg.path("symptom_id").asLong(), "every step selects the same case");
        }
        assertEquals("CODE BLACK", aggs.get(3).path("icu_condition").asText());
    }

    @Test
    void levelStepBoundariesStayWithinTheCaseDespiteClockSkew() throws Exception {
        EngineCase c = lostSignal(12, OPENED.minusSeconds(600), OPENED.plusSeconds(240));
        store.add(c.withLevel(c.openingContext(), c.levelContext(), c.levelRule(), List.of(
                new EngineCase.LevelStep(OPENED, 1), new EngineCase.LevelStep(OPENED.minusSeconds(900), 2),
                new EngineCase.LevelStep(OPENED.plusSeconds(300), 3),
                new EngineCase.LevelStep(OPENED.plusSeconds(120), 4))));

        JsonNode aggs = service.header(TENANT, -12).path("timeline").get(0).path("conditions_agg");

        List<Instant> bounds = List.of(OPENED.minusSeconds(600), OPENED.minusSeconds(600),
                OPENED.plusSeconds(240), OPENED.plusSeconds(240), OPENED.plusSeconds(240));
        assertEquals(4, aggs.size(), "preserve every level step, including zero-duration steps");
        for (int i = 0; i < aggs.size(); i++) {
            assertEquals(bounds.get(i).toString(), aggs.get(i).path("start").asText());
            assertEquals(bounds.get(i + 1).toString(), aggs.get(i).path("end").asText());
            assertEquals(String.valueOf(i + 1), aggs.get(i).path("icu_code").asText());
        }
    }

    @Test
    void actionsLandInTheStepOfTheirTime() throws Exception {
        store.add(escalated(OPENED.plusSeconds(10_000)));
        List<TreatmentView> treatments = List.of(treatment(TreatmentStatus.CLOSED,
                actionAt(OPENED.minusSeconds(900), "Antes"), actionAt(OPENED.plusSeconds(3600), "En L2"),
                actionAt(OPENED.plusSeconds(8000), "En L3"), actionAt(OPENED.plusSeconds(20_000), "Después"),
                actionAt(null, "Sin hora"), action(ActionKind.NOTE, null, null, "nota")),
                treatment(TreatmentStatus.CANCELLED, actionAt(OPENED.plusSeconds(3600), "Cancelado")));
        JsonNode header = service.header(TENANT, -12);
        JsonNode original = header.deepCopy();

        JsonNode aggs = EngineCaseService.withTreatments(header, treatments)
                .path("timeline").get(0).path("conditions_agg");

        assertEquals(List.of("Llamado a: Antes"), messages(aggs.get(0)));
        assertEquals(List.of("Llamado a: En L2"), messages(aggs.get(1)));
        assertEquals(List.of("Llamado a: En L3"), messages(aggs.get(2)));
        assertEquals(List.of("Llamado a: Después", "Llamado a: Sin hora"), messages(aggs.get(3)));
        assertEquals(5, aggs.findValues("treatment_type").size(), "header counters see each call only once");
        aggs.forEach(agg -> assertEquals("operator@example.com", agg.path("assigned_to").asText()));
        assertEquals(original, header, "adding treatments leaves the original header untouched");
    }

    @Test
    void onlyTheStepsThatWereTreatedShowTheOperator() throws Exception {
        store.add(escalated(OPENED.plusSeconds(10_000)));
        List<TreatmentView> treatments = List.of(treatment(TreatmentStatus.CLOSED,
                actionAt(OPENED.plusSeconds(9_500), "En L4")));

        JsonNode aggs = EngineCaseService.withTreatments(service.header(TENANT, -12), treatments)
                .path("timeline").get(0).path("conditions_agg");

        for (int i = 0; i < 3; i++) {
            assertTrue(aggs.get(i).path("assigned_to").isNull(), "untreated step " + (i + 1) + " has no operator");
            assertEquals(List.of(), messages(aggs.get(i)));
        }
        assertEquals("operator@example.com", aggs.get(3).path("assigned_to").asText());
        assertEquals(List.of("Llamado a: En L4"), messages(aggs.get(3)));
    }

    @Test
    void eachStepKeepsItsActionOperatorWhenAnotherOperatorClosesTheTreatment() throws Exception {
        store.add(escalated(OPENED.plusSeconds(10_000)));
        OffsetDateTime at = OPENED.atOffset(ZoneOffset.UTC);
        TreatmentView treatment = new TreatmentView("t", -12, "DEMO01", "T-1", TreatmentType.CALL,
                TreatmentStatus.CLOSED, "opener@example.com", at, "closer@example.com", at.plusSeconds(9_500),
                null, null, at.plusSeconds(9_500), List.of(
                        actionAt(OPENED.plusSeconds(1_800), "En L1", "alice@example.com"),
                        actionAt(OPENED.plusSeconds(4_000), "En L2", "bob@example.com"),
                        actionAt(OPENED.plusSeconds(8_000), "En L3", null)));

        JsonNode aggs = EngineCaseService.withTreatments(service.header(TENANT, -12), List.of(treatment))
                .path("timeline").get(0).path("conditions_agg");

        assertEquals("alice@example.com", aggs.get(0).path("assigned_to").asText());
        assertEquals("bob@example.com", aggs.get(1).path("assigned_to").asText());
        assertEquals("opener@example.com", aggs.get(2).path("assigned_to").asText(),
                "an action without its actor falls back to the opener, never the closer");
        assertTrue(aggs.get(3).path("assigned_to").isNull(), "closing alone does not assign an untreated step");
    }

    @Test
    void aHoldEndAssignsItsStepWithoutReplacingAnEarlierActionOperator() throws Exception {
        store.add(escalated(OPENED.plusSeconds(10_000)));
        OffsetDateTime at = OPENED.atOffset(ZoneOffset.UTC);
        for (String resolution : HoldService.ENDINGS) {
            TreatmentView treatment = new TreatmentView("t", -12, "DEMO01", "T-1", TreatmentType.IGNORE_CONDITION,
                    TreatmentStatus.CLOSED, "opener@example.com", at, HoldService.SYSTEM, at.plusSeconds(9_500),
                    resolution, null, at.plusSeconds(9_500), List.of(action(ActionKind.IGNORE, null, "Motivo", null)));

            JsonNode aggs = EngineCaseService.withTreatments(service.header(TENANT, -12), List.of(treatment))
                    .path("timeline").get(0).path("conditions_agg");

            assertEquals("operator@example.com", aggs.get(0).path("assigned_to").asText());
            assertTrue(aggs.get(1).path("assigned_to").isNull());
            assertTrue(aggs.get(2).path("assigned_to").isNull());
            assertEquals(HoldService.SYSTEM, aggs.get(3).path("assigned_to").asText());
            assertEquals("fin de ignorar", aggs.get(3).path("treatments").get(0).path("treatment_type").asText());
            assertEquals(resolution, aggs.get(3).path("treatments").get(0).path("resolution").asText());
        }
    }

    @Test
    void aCaseWithoutStepsKeepsOneBlock() {
        store.add(panic(12, "DEMO01"));

        JsonNode aggs = service.header(TENANT, -12).path("timeline").get(0).path("conditions_agg");

        assertEquals(1, aggs.size());
        assertEquals("4", aggs.get(0).path("icu_code").asText());
    }

    private static TreatmentAction actionAt(Instant at, String contact) {
        return actionAt(at, contact, "operator@example.com");
    }

    private static TreatmentAction actionAt(Instant at, String contact, String operator) {
        return new TreatmentAction("a", "t", TENANT, 1, ActionKind.CALL, null, contact, null, null, null, null, null,
                null, null, null, null, List.of(), Map.of(), operator,
                at == null ? null : at.atOffset(ZoneOffset.UTC));
    }

    private static List<String> messages(JsonNode agg) {
        List<String> out = new ArrayList<>();
        agg.path("treatments").forEach(row -> out.add(row.path("description").path("message").asText()));
        return out;
    }

    @Test
    void aDateRangeShowsTheCasesActiveInIt() {
        store.add(new EngineCase(12, PANIC, "0.1.0", "Botón de pánico", "emergencies", "DEMO01",
                OPENED.minusSeconds(86_400), 4, "T-1", null, null, null, OPENED.plusSeconds(60), 0, null, 0L));
        store.add(new EngineCase(13, PANIC, "0.1.0", "Botón de pánico", "emergencies", "DEMO02",
                OPENED.minusSeconds(86_400), 4, "T-2", null, null, null, OPENED.minusSeconds(4 * 3600), 0, null, 0L));
        store.add(new EngineCase(14, PANIC, "0.1.0", "Botón de pánico", "emergencies", "DEMO03",
                OPENED.minusSeconds(43_200), 4, "T-3", null, null, null, null, 0, null, 0L));

        JsonNode day = service.withCases(TENANT, Map.of("p_start_date_historic", "2026-10-22T00:00:00Z",
                "p_end_date_historic", "2026-10-23T00:00:00Z"), null);

        assertEquals(List.of(-14L, -12L), ids(day), "closed in the range or still open; not closed before it");
    }

    private static TreatmentView treatment(TreatmentStatus status, TreatmentAction... actions) {
        OffsetDateTime at = OPENED.atOffset(ZoneOffset.UTC);
        return new TreatmentView("t", -12, "DEMO01", "T-1", TreatmentType.CALL, status, "operator@example.com", at,
                status == TreatmentStatus.CLOSED ? "operator@example.com" : null, null, null, null, at,
                List.of(actions));
    }

    private static TreatmentAction action(ActionKind kind, String contact, String outcome, String note) {
        return new TreatmentAction("a", "t", TENANT, 1, kind, null, contact, null, null, null, null, outcome, null,
                null, null, note, List.of(), Map.of(), "operator@example.com", OPENED.atOffset(ZoneOffset.UTC));
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
    void aScriptReadsTheCaseTheVehicleAndTheTripWithoutALiveTrip() {
        store.add(engineCase(12, "KLHH49", 4, 0));

        JsonNode ctx = service.context(TENANT, -12);

        assertEquals("Botón de pánico", ctx.path("case").path("symptom").asText());
        assertEquals(4, ctx.path("case").path("level").asInt());
        assertEquals(-12, ctx.path("case").path("id").asLong());
        assertEquals("KLHH49", ctx.path("vehicle").path("plate").asText());
        assertEquals("T-1", ctx.path("trip").path("id").asText());
        assertFalse(ctx.path("trip").has("driver"), "no live trip, no driver");
        assertTrue(ctx.path("condition").isObject());
    }

    @Test
    void scriptSamplesPutTheLevelsCasesFirstThenTheNewest() {
        store.add(at(1, "OLD", OPENED.minusSeconds(600), null));
        store.add(at(2, "NEW", OPENED, null));
        store.add(engineCase(3, "LEVEL2", 2, 0));

        JsonNode samples = service.scriptSamples(TENANT, "Botón de pánico", 2);

        List<String> assets = new ArrayList<>();
        samples.forEach(s -> assets.add(s.path("asset_id").asText()));
        assertEquals(List.of("LEVEL2", "NEW", "OLD"), assets);
        assertEquals("NEW", samples.get(1).path("context").path("vehicle").path("plate").asText());
        assertEquals(0, service.scriptSamples(TENANT, "Otro síntoma", null).size());
        assertThrows(IllegalArgumentException.class, () -> service.scriptSamples(TENANT, " ", null));
    }

    @Test
    void writesAnEwkbPointAsPostgis() {
        assertEquals("0101000020E6100000000000000000F03F0000000000000040", EngineCaseService.ewkbPoint(1, 2));
    }
}

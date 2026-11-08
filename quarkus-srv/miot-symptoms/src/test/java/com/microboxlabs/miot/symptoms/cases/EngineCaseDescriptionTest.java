package com.microboxlabs.miot.symptoms.cases;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.gps.SignalStates.SignalState;
import com.microboxlabs.miot.core.gps.SignalStates.Status;
import com.microboxlabs.miot.symptoms.duty.DutyChecks;
import com.microboxlabs.miot.symptoms.lostsignal.SignalStateReader.Reported;
import io.vertx.core.json.JsonObject;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The map popup of an engine case carries the GPS database's indicators, in its names and formats. */
class EngineCaseDescriptionTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Instant OPENED = Instant.parse("2026-10-22T03:00:00Z");
    private static final Instant LOST = OPENED.minusSeconds(660);
    private static final Instant NOW = Instant.parse("2026-10-22T07:06:31Z");
    private static final UUID LOST_SIGNAL = UUID.randomUUID();

    private static JsonNode json(String text) throws Exception {
        return JSON.readTree(text);
    }

    private static JsonNode lossAt(Instant last, double silence, boolean returned, Boolean engine) throws Exception {
        return json("""
                {"check": {"loss": {"silence_s": %s, "returned": %s, "last": {"at": "%s"%s}}}}
                """.formatted(silence, returned, last, engine == null ? "" : ", \"engine\": " + engine));
    }

    private static EngineCase lostSignal(Instant closed, JsonNode closing) throws Exception {
        JsonNode opening = lossAt(LOST, 750, false, false);
        return new EngineCase(12, LOST_SIGNAL, "2.2.0", "Pérdida de señal", "signal_continuity", "DEMO01", OPENED,
                1, "T-1", -33.4, -70.6, 0.0, closed, 0, null, 0L, null, opening, opening, "rule",
                List.of(new EngineCase.LevelStep(OPENED, 1))).withClosing(closing);
    }

    private static EngineCase panic() {
        return new EngineCase(13, UUID.randomUUID(), "0.1.0", "Botón de pánico", "emergencies", "DEMO01", OPENED, 4,
                "T-1", -33.4, -70.6, 12.0, null, 0, 2, 1L);
    }

    private static Optional<Reported> profile(Instant lastFrame, Long medianS, Boolean engine) {
        return Optional.of(new Reported(new SignalState(Status.OFFLINE, lastFrame, lastFrame, 100L, 60L), medianS,
                engine));
    }

    @Test
    void anOpenLostSignalShowsTheLiveSilenceTheUsualIntervalAndTheEngine() throws Exception {
        JsonNode d = EngineCaseService.description(lostSignal(null, null), NOW,
                profile(NOW.minusSeconds(4 * 3600 + 6 * 60 + 31), 36L, true), NOW);

        assertEquals("Pérdida de señal", d.path("symptom_name").asText());
        assertEquals("04:06:31", d.path("signal_lag").asText(), "now minus the newest frame's GPS time");
        assertEquals("00:00:36", d.path("median_report_interval").asText());
        assertTrue(d.path("last_reported_engine_status").isBoolean());
        assertTrue(d.path("last_reported_engine_status").asBoolean(), "the profile's newest frame first");
    }

    @Test
    void aClosedLostSignalShowsTheSilenceUntilTheSignalReturned() throws Exception {
        Instant back = LOST.plusSeconds(3725);
        JsonNode closing = lossAt(back, 20, true, null);
        ((com.fasterxml.jackson.databind.node.ObjectNode) closing.path("check").path("loss"))
                .put("returned_frame_at", back.toString());
        JsonNode d = EngineCaseService.description(lostSignal(back.plusSeconds(60), closing),
                back.plusSeconds(60), Optional.empty(), NOW);

        assertEquals("01:02:05", d.path("signal_lag").asText(), "from the last frame before to the return");
        assertFalse(d.has("median_report_interval"), "no profile");
        assertFalse(d.path("last_reported_engine_status").asBoolean(), "the checks' engine without a profile");
    }

    @Test
    void healthyReportsDuringReturnGraceDoNotExtendTheClosedCasesSilence() throws Exception {
        Instant back = LOST.plusSeconds(400);
        JsonNode closing = lossAt(back.plusSeconds(40), 25, true, true);
        ((com.fasterxml.jackson.databind.node.ObjectNode) closing.path("check").path("loss"))
                .put("returned_frame_at", back.toString());

        JsonNode d = EngineCaseService.description(lostSignal(back.plusSeconds(65), closing), NOW,
                Optional.empty(), NOW);
        assertEquals("00:06:40", d.path("signal_lag").asText());
    }

    @Test
    void aLegacyReturnWithoutItsFirstGpsTimeHasNoReliableClosedSignalLag() throws Exception {
        JsonNode closing = lossAt(LOST.plusSeconds(440), 25, true, true);
        JsonNode d = EngineCaseService.description(lostSignal(NOW, closing), NOW, Optional.empty(), NOW);
        assertFalse(d.has("signal_lag"), "the newest frame and current silence do not identify the return");
    }

    @Test
    void aClosedLostSignalThatDidNotReturnShowsTheSilenceItsClosingCheckRead() throws Exception {
        JsonNode d = EngineCaseService.description(lostSignal(NOW, lossAt(LOST, 5400.4, false, null)), NOW,
                Optional.empty(), NOW);

        assertEquals("01:30:00", d.path("signal_lag").asText());
    }

    @Test
    void aClosedLostSignalWithoutAClosingContextHasNoSignalLag() throws Exception {
        JsonNode d = EngineCaseService.description(lostSignal(NOW, null), NOW,
                profile(NOW.minusSeconds(30), 36L, null), NOW);

        assertFalse(d.has("signal_lag"));
        assertEquals("00:00:36", d.path("median_report_interval").asText());
        assertFalse(d.path("last_reported_engine_status").asBoolean(), "the checks' engine: the profile has none");
    }

    @Test
    void anOpenLostSignalWithoutAProfileHasNoSignalLag() throws Exception {
        JsonNode d = EngineCaseService.description(lostSignal(null, null), NOW, Optional.empty(), NOW);

        assertFalse(d.has("signal_lag"));
        assertFalse(d.has("median_report_interval"));
        assertEquals(false, d.path("last_reported_engine_status").asBoolean(true));
    }

    @Test
    void otherSymptomsGetTheIntervalAndEngineButNoSignalLag() {
        JsonNode d = EngineCaseService.description(panic(), NOW, profile(NOW.minusSeconds(4000), 120L, false), NOW);

        assertFalse(d.has("signal_lag"));
        assertEquals("00:02:00", d.path("median_report_interval").asText());
        assertFalse(d.path("last_reported_engine_status").asBoolean(true));
        assertEquals(12.0, d.path("last_reported_speed").asDouble());

        JsonNode none = EngineCaseService.description(panic(), NOW, Optional.empty(), NOW);
        assertFalse(none.has("median_report_interval"));
        assertFalse(none.has("last_reported_engine_status"));
    }

    @Test
    void aDutyContextWithGeoSurvivesJsonStorageAndTheCasePopup() throws Exception {
        Map<String, Object> geo = Map.of("authorized_zone", true, "zone", "Synthetic zone",
                "risk_zone", false, "outside_authorized", false);
        DutyChecks.Check check = new DutyChecks.Check(Map.of("driving_minutes", 280.0,
                "resting_minutes", 0.0, "duty_minutes", 280.0, "signal_lost_minutes", 0.0,
                "trip", Map.of("active", true, "id", "T-1"), "geo", geo), null);
        // PgTransitionLog writes the context as a Vert.x JsonObject to its JSONB column.
        JsonNode kept = JSON.readTree(new JsonObject(check.context()).encode());
        assertEquals(JSON.valueToTree(geo), kept.path("check").path("geo"));
        assertFalse(kept.path("check").has("trip"));

        EngineCase c = new EngineCase(14, UUID.randomUUID(), "0.1.0", "Conducción continua", "driving",
                "DEMO01", OPENED, 2, "T-1", null, null, 60.0, null, 0, null, 0L)
                .withLevel(kept, kept, "check.driving_minutes >= 270", List.of(new EngineCase.LevelStep(OPENED, 2)));
        InMemoryEngineCases store = new InMemoryEngineCases();
        store.add(c);
        EngineCaseService service = new EngineCaseService(store, (t, a, d) -> { }, t -> null,
                Clock.fixed(NOW, ZoneOffset.UTC), com.microboxlabs.miot.symptoms.events.SymptomEvents.NONE,
                (asset, now) -> profile(now.minusSeconds(60), 36L, true));

        assertEquals(kept, service.header("tenant-demo", c.symptomId())
                .path("level_reason").path("context"));
        JsonNode description = service.signals("tenant-demo", c.symptomId()).path("description");
        assertEquals("Conducción continua", description.path("symptom_name").asText());
        assertEquals("00:00:36", description.path("median_report_interval").asText());
        assertTrue(description.path("last_reported_engine_status").asBoolean());
        assertEquals(60.0, description.path("last_reported_speed").asDouble());
        assertFalse(description.has("signal_lag"), "a duty check with geo is not a lost-signal check");
    }

    @Test
    void intervalsAreWrittenLikeTheGpsDatabase() {
        assertEquals("00:00:00", EngineCaseService.hms(0));
        assertEquals("00:00:36", EngineCaseService.hms(36));
        assertEquals("04:06:31", EngineCaseService.hms(14791));
        assertEquals("26:00:05", EngineCaseService.hms(93605));
    }

    @Test
    void theServiceReadsTheVehicleAndSurvivesAFailedRead() throws Exception {
        InMemoryEngineCases store = new InMemoryEngineCases();
        store.add(lostSignal(null, null));
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EngineCaseService service = new EngineCaseService(store, (t, a, d) -> { }, t -> null, clock,
                com.microboxlabs.miot.symptoms.events.SymptomEvents.NONE,
                (asset, now) -> "DEMO01".equals(asset) ? profile(now.minusSeconds(600), 36L, true) : Optional.empty());
        EngineCaseService failing = new EngineCaseService(store, (t, a, d) -> { }, t -> null, clock,
                com.microboxlabs.miot.symptoms.events.SymptomEvents.NONE, (asset, now) -> {
                    throw new IllegalStateException("Redis down");
                });

        JsonNode d = service.signals("tenant-demo", -12).path("description");
        assertEquals("00:10:00", d.path("signal_lag").asText());
        assertFalse(service.signals("tenant-demo", -12).path("closed").asBoolean(true));
        JsonNode down = failing.signals("tenant-demo", -12).path("description");
        assertFalse(down.has("signal_lag"));
        assertEquals("Pérdida de señal", down.path("symptom_name").asText());
    }
}

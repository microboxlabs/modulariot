package com.microboxlabs.miot.symptoms.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.microboxlabs.miot.core.gps.SignalStates;
import com.microboxlabs.miot.core.gps.SignalStates.SignalState;
import com.microboxlabs.miot.core.gps.SignalStates.Status;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import org.junit.jupiter.api.Test;

class SignalStateFieldsTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Instant NOW = Instant.parse("2026-03-01T12:00:00Z");
    private static final Duration MAX_SILENCE = Duration.ofDays(1);
    private static final String TWO_WEEKS_AGO = "2026-02-15T12:00:00+00:00";
    private static final String AN_HOUR_AGO = "2026-03-01T11:00:00+00:00";

    /** ON online, OFF offline; any other asset has no profile. */
    private final SignalStates detector = (ids, now) -> {
        Map<String, SignalState> out = new LinkedHashMap<>();
        for (String id : ids) {
            out.put(id, switch (id) {
                case "ON" -> new SignalState(Status.ONLINE, null, now.minusSeconds(30), 30L, 180L);
                case "OFF" -> new SignalState(Status.OFFLINE, Instant.parse("2026-02-20T00:00:00Z"),
                        Instant.parse("2026-02-20T00:00:00Z"), 100L, 60L);
                default -> SignalState.UNKNOWN;
            });
        }
        return out;
    };

    private static ArrayNode positions(String... assetAndTimestamp) {
        ArrayNode out = JSON.createArrayNode();
        for (int i = 0; i < assetAndTimestamp.length; i += 2) {
            out.addObject().put("asset_id", assetAndTimestamp[i]).put("timestamp", assetAndTimestamp[i + 1])
                    .put("speed", 60);
        }
        return out;
    }

    @Test
    void anAssetWithoutProfileSilentPastMaxSilenceIsOfflineSinceItsPosition() {
        JsonNode out = SignalStateFields.withSignal(positions("SILENT", TWO_WEEKS_AGO, "RECENT", AN_HOUR_AGO),
                detector, NOW, MAX_SILENCE);

        JsonNode silent = out.get(0).path("signal");
        assertEquals("offline", silent.path("state").asText());
        assertEquals("2026-02-15T12:00:00Z", silent.path("offline_since").asText());
        assertEquals("2026-02-15T12:00:00Z", silent.path("last_frame_at").asText());
        assertEquals(Duration.ofDays(14).toSeconds(), silent.path("silence_s").asLong());
        assertFalse(silent.has("expected_s"));

        JsonNode recent = out.get(1).path("signal");
        assertEquals("unknown", recent.path("state").asText());
        assertEquals(1, recent.size());
    }

    @Test
    void oneAgreesWithThePositions() {
        ArrayNode p = positions("SILENT", TWO_WEEKS_AGO, "RECENT", AN_HOUR_AGO);

        JsonNode silent = SignalStateFields.one(p, "SILENT", detector, NOW, MAX_SILENCE);
        assertEquals(SignalStateFields.withSignal(p, detector, NOW, MAX_SILENCE).get(0).path("signal"), silent);
        assertEquals("offline", silent.path("state").asText());
        assertEquals("unknown", SignalStateFields.one(p, "RECENT", detector, NOW, MAX_SILENCE)
                .path("state").asText());
    }

    @Test
    void theDetectorsOnlineAndOfflineAreKeptWhateverThePositionsAge() {
        ArrayNode p = positions("ON", TWO_WEEKS_AGO, "OFF", AN_HOUR_AGO);

        JsonNode out = SignalStateFields.withSignal(p, detector, NOW, MAX_SILENCE);

        assertEquals(SignalStateFields.node(detector.state("ON", NOW)), out.get(0).path("signal"));
        assertEquals(SignalStateFields.node(detector.state("OFF", NOW)), out.get(1).path("signal"));
        assertEquals("online", SignalStateFields.one(p, "ON", detector, NOW, MAX_SILENCE).path("state").asText());
        assertEquals(60, SignalStateFields.one(p, "OFF", detector, NOW, MAX_SILENCE).path("expected_s").asLong());
    }

    @Test
    void positionsWithoutAReadableTimestampStayUnknown() {
        ArrayNode p = positions("A", "not a time");
        p.addObject().put("asset_id", "B");

        JsonNode out = SignalStateFields.withSignal(p, detector, NOW, MAX_SILENCE);

        assertEquals("unknown", out.get(0).path("signal").path("state").asText());
        assertEquals("unknown", out.get(1).path("signal").path("state").asText());
    }

    /** The fallback's offline_since and last_frame_at are the position's time: the app's newest-frame check. */
    @Test
    void theFallbacksLastFrameIsThePositionsTimeToTheMillisecond() {
        ArrayNode p = positions("SILENT", "2026-02-15T12:00:00.123456+00:00");

        JsonNode signal = SignalStateFields.withSignal(p, detector, NOW, MAX_SILENCE).get(0).path("signal");

        assertEquals(Instant.parse("2026-02-15T12:00:00.123456Z").toEpochMilli(),
                Instant.parse(signal.path("last_frame_at").asText()).toEpochMilli());
    }

    @Test
    void aFailedReadIsWarnedOncePerMinuteAndThePositionsStay() {
        List<LogRecord> records = new ArrayList<>();
        Handler handler = new Handler() {
            @Override
            public void publish(LogRecord r) {
                records.add(r);
            }

            @Override
            public void flush() {
            }

            @Override
            public void close() {
            }
        };
        Logger logger = Logger.getLogger(SignalStateFields.class.getName());
        logger.addHandler(handler);
        SignalStates failing = (ids, now) -> {
            throw new IllegalStateException("Redis waiting queue is full");
        };
        // Far from the other tests' clocks, so an earlier warning does not hold this one back.
        Instant at = Instant.parse("2030-01-01T00:00:00Z");
        try {
            JsonNode out = SignalStateFields.withSignal(positions("A", AN_HOUR_AGO, "B", "2029-12-31T23:30:00Z"),
                    failing, at, MAX_SILENCE);
            SignalStateFields.withSignal(positions("A", AN_HOUR_AGO), failing, at.plusSeconds(30), MAX_SILENCE);

            assertEquals(2, out.size());
            assertEquals("A", out.get(0).path("asset_id").asText());
            assertEquals("offline", out.get(0).path("signal").path("state").asText(),
                    "a position older than max silence is offline even without the detector");
            assertEquals("unknown", out.get(1).path("signal").path("state").asText());
            List<LogRecord> warnings = records.stream()
                    .filter(r -> r.getLevel().intValue() >= Level.WARNING.intValue()).toList();
            assertEquals(1, warnings.size(), "once a minute: the map polls the positions");
            String message = format(warnings.get(0));
            assertTrue(message.contains("Redis waiting queue is full"), message);

            SignalStateFields.withSignal(positions("A", AN_HOUR_AGO), failing, at.plusSeconds(61), MAX_SILENCE);
            assertEquals(2, records.stream()
                    .filter(r -> r.getLevel().intValue() >= Level.WARNING.intValue()).count());
        } finally {
            logger.removeHandler(handler);
        }
    }

    private static String format(LogRecord r) {
        return new java.util.logging.SimpleFormatter().formatMessage(r);
    }
}

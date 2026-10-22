package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class SignalSamplesTest {

    private static final ObjectMapper JSON = new ObjectMapper()
            .setSerializationInclusion(JsonInclude.Include.NON_NULL);
    private static final String TENANT = "tenant-a";

    @Test
    @SuppressWarnings("unchecked")
    void fixedSamplesAreSignalsOfTheContract() throws Exception {
        for (Map<String, Object> sample : SignalSamples.fallback()) {
            Map<String, Object> signal = (Map<String, Object>) sample.get(SignalFields.ROOT);
            GpsSignal parsed = JSON.convertValue(signal, GpsSignal.class);
            Map<String, Object> back = JSON.readValue(JSON.writeValueAsString(parsed), new TypeReference<>() {
            });
            Map<String, Object> read = new LinkedHashMap<>();
            values(SignalFields.ROOT, back, read);
            Map<String, Object> written = new LinkedHashMap<>();
            values(SignalFields.ROOT, signal, written);
            written.forEach((path, value) -> assertEquals(value, read.get(path), path + " in " + GpsSignal.SCHEMA_ID));
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void fixedSamplesOnlyUseFieldsTheEditorShows() {
        Set<String> fields = SignalFields.fields().stream().map(SourceField::path).collect(Collectors.toSet());
        for (Map<String, Object> sample : SignalSamples.fallback()) {
            List<String> leaves = new ArrayList<>();
            leaves(SignalFields.ROOT, (Map<String, Object>) sample.get(SignalFields.ROOT), leaves);
            leaves.forEach(path -> assertTrue(fields.contains(path), path));
        }
    }

    @Test
    void keepsOneSignalPerOrganizationEveryFifteenSeconds() {
        MutableClock clock = new MutableClock();
        SignalSamples samples = new SignalSamples(null, clock);

        samples.record(TENANT, Map.of("asset_id", "A"));
        samples.record(TENANT, Map.of("asset_id", "B"));
        samples.record("tenant-b", Map.of("asset_id", "C"));
        clock.now = clock.now.plus(SignalSamples.EVERY);
        samples.record(TENANT, Map.of("asset_id", "D"));

        assertEquals(List.of("D", "A"), assets(samples.recent(TENANT, 5)));
        assertEquals(List.of("C"), assets(samples.recent("tenant-b", 5)));
        assertEquals(List.of("D"), assets(samples.recent(TENANT, 1)));
    }

    @Test
    void keepsTheNewestTwenty() {
        MutableClock clock = new MutableClock();
        SignalSamples samples = new SignalSamples(null, clock);
        for (int i = 0; i < SignalSamples.KEEP + 5; i++) {
            samples.record(TENANT, Map.of("asset_id", "A" + i));
            clock.now = clock.now.plus(SignalSamples.EVERY);
        }

        List<String> kept = assets(samples.recent(TENANT, 100));

        assertEquals(SignalSamples.KEEP, kept.size());
        assertEquals("A24", kept.get(0));
    }

    @Test
    void dropsRoutingFieldsAndTheFramePartsRulesDoNotRead() {
        Map<String, Object> frame = Map.of("asset_id", "A", "driver_info", Map.of("name", "x"),
                "sensors", Map.of("panic_button", true));
        Map<String, Object> trimmed = SignalSamples.trim(Map.of("schema", GpsSignal.SCHEMA_ID,
                "at", "2026-10-22T03:00:00Z", "clients", List.of(TENANT), "asset_id", "A", "frame", frame));

        assertEquals(Map.of("asset_id", "A", "frame", Map.of("sensors", Map.of("panic_button", true))), trimmed);
    }

    @Test
    void redisKeepsTheListInOneScript() {
        List<String> args = SignalSamples.recordArgs(TENANT, "{}");

        assertEquals(List.of(SignalSamples.RECORD_SCRIPT, "1", "symptoms:samples:tenant-a", "{}", "20", "86400"), args);
    }

    @SuppressWarnings("unchecked")
    private static List<String> assets(List<Map<String, Object>> samples) {
        return samples.stream().map(s -> (String) ((Map<String, Object>) s.get(SignalFields.ROOT)).get("asset_id"))
                .toList();
    }

    private static void leaves(String prefix, Map<String, Object> node, List<String> out) {
        Map<String, Object> values = new LinkedHashMap<>();
        values(prefix, node, values);
        out.addAll(values.keySet());
    }

    @SuppressWarnings("unchecked")
    private static void values(String prefix, Map<String, Object> node, Map<String, Object> out) {
        node.forEach((k, v) -> {
            if (v instanceof Map<?, ?> child) {
                values(prefix + "." + k, (Map<String, Object>) child, out);
            } else {
                out.put(prefix + "." + k, v);
            }
        });
    }

    private static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-10-22T03:00:00Z");

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}

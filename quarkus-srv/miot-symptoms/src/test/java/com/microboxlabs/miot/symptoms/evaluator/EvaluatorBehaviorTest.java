package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.duty.DutyChecks;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorBenchmarkTest.Env;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorBenchmarkTest.Signal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Full transition, episode and duty fingerprints captured on debe97044, before the evaluator optimizations.
 * Generated definition UUIDs are normalized to tenant/key; versions, signal times and all state are retained.
 */
class EvaluatorBehaviorTest {

    private static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    private static final Instant START = Instant.parse("2026-11-07T12:00:00Z");

    @Test
    void transitionsAndEpisodesAfterEverySignalMatchTheOriginalEvaluator() throws Exception {
        Env env = new Env(0, 0);
        try {
            UUID speedId = publishSpeedCase(env);
            Map<String, String> ids = identities(env);
            MessageDigest transitions = MessageDigest.getInstance("SHA-256");
            MessageDigest episodes = MessageDigest.getInstance("SHA-256");
            List<Signal> signals = signalsWithLevelChanges();
            int recorded = 0;
            for (int i = 0; i < signals.size(); i++) {
                Signal signal = signals.get(i);
                env.stream.evaluate(signal.json(), START.plusSeconds(i));
                // Replays and out-of-order frames must leave the same episodes and case history too.
                if (i % 29 == 0) {
                    env.stream.evaluate(signal.json(), START.plusSeconds(i));
                }
                if (i >= 40 && i % 31 == 0) {
                    env.stream.evaluate(signals.get(i - 40).json(), START.plusSeconds(i));
                }
                List<String> changes = new ArrayList<>();
                for (Transition t : env.recorded.recorded.subList(recorded, env.recorded.recorded.size())) {
                    changes.add(normalized(t, ids));
                }
                changes.stream().sorted().forEach(s -> update(transitions, s));
                recorded = env.recorded.recorded.size();
                update(episodes, normalized(snapshot(env, signal.assetId()), ids));
            }
            for (Transition.Kind kind : List.of(Transition.Kind.OPENED, Transition.Kind.LEVEL_CHANGED,
                    Transition.Kind.CLOSED)) {
                assertTrue(env.recorded.recorded.stream().anyMatch(t -> t.kind() == kind), kind.name());
            }
            assertEquals(List.of("OPENED:1", "LEVEL_CHANGED:2", "LEVEL_CHANGED:3", "LEVEL_CHANGED:4", "CLOSED:4"),
                    env.recorded.recorded.stream().filter(t -> t.definitionId().equals(speedId))
                            .filter(t -> t.assetId().equals("PARITY00")).map(t -> t.kind() + ":" + t.level()).toList());
            assertEquals("d6a5c55173bee008ed462f28a955cecf8e3af9cffab04887c8eab80a0876116c",
                    HexFormat.of().formatHex(transitions.digest()), "full transition history before optimization");
            assertEquals("5cd0c39bce0e785594c81847a48e658beeb658a0718019ff0e9d59a277f07d7c",
                    HexFormat.of().formatHex(episodes.digest()), "episodes, watermarks and duty after every signal");
        } finally {
            env.redis.close();
        }
    }

    private static UUID publishSpeedCase(Env env) {
        String tenant = EvaluatorBenchmarkTest.ORG;
        UUID id = env.catalog.create(tenant, "bench@example.com", new CreateRequest("parity-speed", "Parity speed",
                null, null, null, "gps_signal", null, Specs.with(Specs.speeding(), "true"))).definition().id();
        env.catalog.publish(tenant, "bench@example.com", id, "Parity fixture", null, SymptomState.TEST);
        return id;
    }

    private static List<Signal> signalsWithLevelChanges() throws Exception {
        List<Signal> signals = new ArrayList<>(EvaluatorBenchmarkTest.signals(40, 2000, START, 7));
        int[] speeds = {92, 96, 102, 112, 112, 112, 80, 80, 80, 80, 80};
        for (int i = 0; i < speeds.length; i++) {
            ObjectNode signal = (ObjectNode) JSON.readTree(signals.get(0).json());
            Instant at = START.plusSeconds(7200L + 30L * i);
            signal.put("asset_id", "PARITY00");
            signal.put("at", at.toString());
            signal.put("received_at", at.plusMillis(800).toString());
            ((ObjectNode) signal.path("frame")).put("asset_id", "PARITY00");
            ((ObjectNode) signal.path("frame").path("gps")).put("speed", speeds[i]);
            signals.add(new Signal("PARITY00", JSON.writeValueAsString(signal)));
        }
        return signals;
    }

    @Test
    void eightVehicleLanesKeepTheSameTransitionsAndIsolatedEpisodes() throws Exception {
        Env sequential = new Env(0, 0);
        Env concurrent = new Env(0, 0);
        try {
            List<Signal> signals = EvaluatorBenchmarkTest.signals(40, 2000, START, 7);
            EvaluatorBenchmarkTest.lanes(sequential, signals, 1);
            // Initialize Mutiny context propagation before starting the concurrent workers.
            concurrent.stream.evaluate(signals.get(0).json(), START);
            EvaluatorBenchmarkTest.lanes(concurrent, signals, 8);
            assertEquals(changes(sequential), changes(concurrent));
            for (int vehicle = 0; vehicle < 40; vehicle++) {
                String asset = "BENCH%04d".formatted(vehicle);
                assertEquals(normalized(snapshot(sequential, asset), identities(sequential)),
                        normalized(snapshot(concurrent, asset), identities(concurrent)), asset);
            }
        } finally {
            sequential.redis.close();
            concurrent.redis.close();
        }
    }

    private static List<String> changes(Env env) throws Exception {
        List<String> out = new ArrayList<>();
        Map<String, String> ids = identities(env);
        for (Transition t : env.recorded.recorded) {
            out.add(normalized(t, ids));
        }
        return out.stream().sorted().toList();
    }

    private static Map<String, String> identities(Env env) {
        Map<String, String> ids = new TreeMap<>();
        for (String tenant : List.of(EvaluatorBenchmarkTest.ORG, EvaluatorBenchmarkTest.OTHER)) {
            env.catalog.list(tenant).forEach(s -> ids.put(s.definition().id().toString(),
                    tenant + "/" + s.definition().key()));
        }
        return ids;
    }

    private static Map<String, Object> snapshot(Env env, String assetId) {
        Map<String, Object> out = new TreeMap<>();
        for (String tenant : List.of(EvaluatorBenchmarkTest.ORG, EvaluatorBenchmarkTest.OTHER)) {
            AssetEpisodes state = env.episodes.load(tenant, assetId);
            Map<String, Object> own = new TreeMap<>();
            env.catalog.list(tenant).forEach(s -> own.put(s.definition().key(),
                    state.find(tenant, assetId, s.definition().id()).orElse(null)));
            Map<String, Object> watermarks = new LinkedHashMap<>();
            watermarks.put("gps", state.watermark(tenant, assetId, EvaluatorStream.SOURCE).orElse(null));
            watermarks.put("duty", state.watermark(tenant, assetId, DutyChecks.WATERMARK).orElse(null));
            own.put("watermarks", watermarks);
            own.put("dutyCounters", env.duty.load(tenant, assetId));
            out.put(tenant, own);
        }
        return out;
    }

    /**
     * What the fingerprints were taken without: the case's trip on episodes and CLOSED changes, why a case closed
     * after its trip, and the trip's last duty counters. Their own tests cover them.
     */
    private static JsonNode withoutCaseTrips(JsonNode node) {
        if (node instanceof ObjectNode o) {
            o.remove(List.of("tripId", "lastContext", "tripEnded"));
            if (com.microboxlabs.miot.symptoms.lostsignal.TripEnds.REASON.equals(o.path("reason").asText())) {
                o.remove("reason");
            }
            o.forEach(EvaluatorBehaviorTest::withoutCaseTrips);
        } else if (node != null && node.isArray()) {
            node.forEach(EvaluatorBehaviorTest::withoutCaseTrips);
        }
        return node;
    }

    private static String normalized(Object value, Map<String, String> ids) throws Exception {
        value = withoutCaseTrips(JSON.valueToTree(value));
        if (value instanceof ObjectNode transition && transition.has("previousLevel")) {
            // The original fingerprint predates the operator decision; OperatorDecisionTest covers it.
            transition.remove("operator");
            if (transition.get("detail") instanceof ObjectNode detail && detail.has(SpeedLimitContext.KEY)) {
                // The original fingerprint covers decisions. Speed evidence is checked by EvaluatorStreamTest.
                detail.remove(SpeedLimitContext.KEY);
            }
            if (transition.get("detail") instanceof ObjectNode detail && detail.isEmpty()) {
                transition.putNull("detail");
            }
            value = transition;
        }
        String text = JSON.writeValueAsString(value);
        for (Map.Entry<String, String> id : ids.entrySet()) {
            text = text.replace(id.getKey(), id.getValue());
        }
        return text;
    }

    private static void update(MessageDigest digest, String value) {
        digest.update(value.getBytes(StandardCharsets.UTF_8));
        digest.update((byte) '\n');
    }
}

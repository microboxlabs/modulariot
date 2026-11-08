package com.microboxlabs.miot.symptoms.evaluator;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The speed limit a speed symptom compared the frame with, kept in its changes' context as
 * {@code speed_limit}: {@code kmh} and {@code source} ({@code custom} or {@code road}, as its measure reads),
 * the two limits the signal had ({@code road_kmh}, {@code custom_kmh}), and where
 * they come from ({@code osm_way_id}, {@code road_class}, {@code zone_id}, {@code zone_name}). Each transition
 * uses its compiled measure's source. Built from the signal the rules
 * already read: no query.
 */
final class SpeedLimitContext {

    static final String KEY = "speed_limit";
    private static final String ROAD = "road";

    private SpeedLimitContext() {
    }

    /**
     * Each speed transition keeps the limit its own measure compared with, without adding evidence to other
     * symptoms in the batch. Existing note and closure details are preserved.
     */
    static List<Transition> with(Map<String, Object> signal, List<Transition> transitions,
            List<CompiledSymptom> symptoms) {
        if (transitions.isEmpty()) {
            return transitions;
        }
        Map<UUID, String> sources = new LinkedHashMap<>();
        symptoms.stream().filter(s -> s.speedLimitSource() != null)
                .forEach(s -> sources.put(s.definitionId(), s.speedLimitSource()));
        return transitions.stream().map(t -> with(t, of(signal, sources.get(t.definitionId())))).toList();
    }

    private static Transition with(Transition t, Map<String, Object> limit) {
        if (limit.isEmpty() || t.detail() != null) {
            return t;
        }
        return new Transition(t.kind(), t.definitionId(), t.version(), t.state(), t.assetId(), t.at(), t.level(),
                t.previousLevel(), t.measure(), Map.of(KEY, limit));
    }

    /** The signal's limits, or an empty map when it has none. */
    static Map<String, Object> of(Map<String, Object> signal, String source) {
        if (source == null || signal == null || !(signal.get(ROAD) instanceof Map<?, ?> road)) {
            return Map.of();
        }
        Double osm = positive(road.get("maxspeed_osm"));
        Double custom = positive(road.get("maxspeed_custom"));
        boolean own = "custom".equals(source);
        Double applied = own ? custom : osm;
        if (applied == null) {
            return Map.of();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kmh", applied);
        out.put("source", source);
        putIfPresent(out, "road_kmh", osm);
        putIfPresent(out, "custom_kmh", custom);
        putIfPresent(out, "osm_way_id", road.get("osm_way_id"));
        putIfPresent(out, "road_class", road.get("road_class"));
        if (own) {
            putIfPresent(out, "zone_id", road.get("custom_zone_id"));
            putIfPresent(out, "zone_name", road.get("custom_zone_name"));
        }
        return out;
    }

    private static Double positive(Object v) {
        return v instanceof Number n && n.doubleValue() > 0 ? n.doubleValue() : null;
    }

    private static void putIfPresent(Map<String, Object> out, String key, Object value) {
        if (value != null) {
            out.put(key, value);
        }
    }
}

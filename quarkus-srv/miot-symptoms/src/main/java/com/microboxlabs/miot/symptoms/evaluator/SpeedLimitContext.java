package com.microboxlabs.miot.symptoms.evaluator;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The speed limit a speed symptom compared the frame with, kept in its changes' context as
 * {@code speed_limit}: {@code kmh} and {@code source} ({@code custom} when the organization has its own limit for
 * the place, else {@code road}), the two limits the signal had ({@code road_kmh}, {@code custom_kmh}), and where
 * they come from ({@code osm_way_id}, {@code road_class}, {@code zone_id}, {@code zone_name}). The platform
 * templates read the own limit first, so {@code kmh} is the one they applied. Built from the signal the rules
 * already read: no query.
 */
final class SpeedLimitContext {

    static final String KEY = "speed_limit";
    private static final String ROAD = "road";

    private SpeedLimitContext() {
    }

    /**
     * The context with the signal's limits added when one of the changes is of a symptom that reads
     * {@code signal.road}; the context unchanged otherwise, or when the signal has no limit.
     */
    static Map<String, Object> with(Map<String, Object> context, Map<String, Object> signal,
            List<Transition> transitions, List<CompiledSymptom> symptoms) {
        if (transitions.isEmpty() || !readsRoad(transitions, symptoms)) {
            return context;
        }
        Map<String, Object> limit = of(signal);
        if (limit == null) {
            return context;
        }
        Map<String, Object> out = context == null ? new LinkedHashMap<>() : new LinkedHashMap<>(context);
        out.put(KEY, limit);
        return out;
    }

    private static boolean readsRoad(List<Transition> transitions, List<CompiledSymptom> symptoms) {
        for (Transition t : transitions) {
            UUID id = t.definitionId();
            for (CompiledSymptom s : symptoms) {
                if (s.definitionId().equals(id) && s.reads("signal." + ROAD)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** The signal's limits, or null when it has none. */
    static Map<String, Object> of(Map<String, Object> signal) {
        if (signal == null || !(signal.get(ROAD) instanceof Map<?, ?> road)) {
            return null;
        }
        Double osm = positive(road.get("maxspeed_osm"));
        Double custom = positive(road.get("maxspeed_custom"));
        if (osm == null && custom == null) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kmh", custom != null ? custom : osm);
        out.put("source", custom != null ? "custom" : ROAD);
        putIfPresent(out, "road_kmh", osm);
        putIfPresent(out, "custom_kmh", custom);
        putIfPresent(out, "osm_way_id", road.get("osm_way_id"));
        putIfPresent(out, "road_class", road.get("road_class"));
        if (custom != null) {
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

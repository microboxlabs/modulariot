package com.microboxlabs.miot.symptoms.map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.core.gps.SignalStates;
import com.microboxlabs.miot.core.gps.SignalStates.SignalState;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import org.jboss.logging.Logger;

/** The lost-signal detector's state on the map's positions, as {@code signal} on each. */
public final class SignalStateFields {

    /** The GPS database's position functions name the asset {@code asset_id}; older payloads {@code assetid}. */
    static final List<String> ASSET_KEYS = List.of("asset_id", "assetid");
    static final String SIGNAL = "signal";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Logger LOG = Logger.getLogger(SignalStateFields.class);

    private SignalStateFields() {
    }

    /**
     * A copy of the positions, each with its asset's {@code signal}; the cached answer is left as it was. Without a
     * state source every position is {@code unknown}.
     */
    public static JsonNode withSignal(JsonNode positions, SignalStates states, Instant now) {
        if (positions == null || !positions.isArray()) {
            return positions;
        }
        ArrayNode out = positions.deepCopy();
        List<String> ids = new ArrayList<>();
        out.forEach(p -> {
            String id = assetOf(p);
            if (id != null) {
                ids.add(id);
            }
        });
        Map<String, SignalState> found = read(states, ids, now);
        out.forEach(p -> {
            if (p instanceof ObjectNode o) {
                String id = assetOf(o);
                SignalState s = id == null ? null : found.get(id);
                o.set(SIGNAL, node(s == null ? SignalState.UNKNOWN : s));
            }
        });
        return out;
    }

    /**
     * The state of one asset among the organization's positions.
     *
     * @throws NoSuchElementException when the positions do not have it
     */
    public static JsonNode one(JsonNode positions, String assetId, SignalStates states, Instant now) {
        boolean ours = false;
        if (positions != null && positions.isArray()) {
            for (JsonNode p : positions) {
                ours |= assetId.equals(assetOf(p));
            }
        }
        if (!ours) {
            throw new NoSuchElementException("Asset not found");
        }
        return node(read(states, List.of(assetId), now).getOrDefault(assetId, SignalState.UNKNOWN));
    }

    /** The position's asset id, under either name, or null. */
    static String assetOf(JsonNode position) {
        for (String key : ASSET_KEYS) {
            JsonNode v = position.path(key);
            if (v.isTextual() && !v.asText().isBlank()) {
                return v.asText();
            }
        }
        return null;
    }

    /** A detector-store outage must not hide the organization's map positions. */
    private static Map<String, SignalState> read(SignalStates states, List<String> ids, Instant now) {
        if (states == null || ids.isEmpty()) {
            return Map.of();
        }
        try {
            return states.states(ids, now);
        } catch (RuntimeException e) {
            LOG.debugf("Map: signal states not read (%s)", e.getClass().getSimpleName());
            return Map.of();
        }
    }

    static JsonNode node(SignalState s) {
        return JSON.valueToTree(s.fields());
    }
}

package com.microboxlabs.miot.symptoms.map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.core.gps.SignalStates;
import com.microboxlabs.miot.core.gps.SignalStates.SignalState;
import com.microboxlabs.miot.core.gps.SignalStates.Status;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.atomic.AtomicLong;
import org.jboss.logging.Logger;

/**
 * The lost-signal detector's state on the map's positions, as {@code signal} on each. When the detector has no
 * profile of the asset (never seen, or expired after its TTL) and the position is older than {@code maxSilence},
 * the asset is offline since the position: the detector would have marked it so before its profile expired.
 */
public final class SignalStateFields {

    /** The GPS database's position functions name the asset {@code asset_id}; older payloads {@code assetid}. */
    static final List<String> ASSET_KEYS = List.of("asset_id", "assetid");
    static final String SIGNAL = "signal";
    static final String TIMESTAMP = "timestamp";
    /** A failed read is logged at most once in this time: the map polls the positions. */
    static final Duration WARN_EVERY = Duration.ofMinutes(1);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Logger LOG = Logger.getLogger(SignalStateFields.class);
    private static final AtomicLong LAST_WARN = new AtomicLong(Long.MIN_VALUE);

    private SignalStateFields() {
    }

    /**
     * A copy of the positions, each with its asset's {@code signal}; the cached answer is left as it was. Without a
     * state source every position is {@code unknown}, or offline when older than {@code maxSilence}.
     */
    public static JsonNode withSignal(JsonNode positions, SignalStates states, Instant now, Duration maxSilence) {
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
                o.set(SIGNAL, node(orSilent(s, o, now, maxSilence)));
            }
        });
        return out;
    }

    /**
     * The state of one asset among the organization's positions, as {@link #withSignal} gives it.
     *
     * @throws NoSuchElementException when the positions do not have it
     */
    public static JsonNode one(JsonNode positions, String assetId, SignalStates states, Instant now,
            Duration maxSilence) {
        JsonNode position = null;
        if (positions != null && positions.isArray()) {
            for (JsonNode p : positions) {
                if (assetId.equals(assetOf(p))) {
                    position = p;
                }
            }
        }
        if (position == null) {
            throw new NoSuchElementException("Asset not found");
        }
        return node(orSilent(read(states, List.of(assetId), now).get(assetId), position, now, maxSilence));
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

    /** The detector's state; when it does not know the asset, offline since a position older than maxSilence. */
    static SignalState orSilent(SignalState s, JsonNode position, Instant now, Duration maxSilence) {
        if (s != null && s.status() != Status.UNKNOWN) {
            return s;
        }
        Instant at = timestampOf(position);
        if (at == null || maxSilence == null || Duration.between(at, now).compareTo(maxSilence) <= 0) {
            return SignalState.UNKNOWN;
        }
        return new SignalState(Status.OFFLINE, at, at, Duration.between(at, now).toSeconds(), null);
    }

    /** The position's GPS time, or null when it has none in ISO-8601 with an offset. */
    static Instant timestampOf(JsonNode position) {
        JsonNode v = position.path(TIMESTAMP);
        if (!v.isTextual()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(v.asText().trim().replace(' ', 'T')).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** A detector-store outage must not hide the organization's map positions. */
    private static Map<String, SignalState> read(SignalStates states, List<String> ids, Instant now) {
        if (states == null || ids.isEmpty()) {
            return Map.of();
        }
        try {
            return states.states(ids, now);
        } catch (RuntimeException e) {
            warn(e, now);
            return Map.of();
        }
    }

    /** At most once per {@link #WARN_EVERY} of {@code now}. */
    private static void warn(RuntimeException e, Instant now) {
        long at = now.toEpochMilli();
        long last = LAST_WARN.get();
        if (last != Long.MIN_VALUE && Math.abs(at - last) < WARN_EVERY.toMillis()) {
            return;
        }
        if (LAST_WARN.compareAndSet(last, at)) {
            LOG.warnf("Map: signal states not read, positions without the detector's state (%s: %s)", e.getClass().getSimpleName(),
                    e.getMessage());
        }
    }

    static JsonNode node(SignalState s) {
        return JSON.valueToTree(s.fields());
    }
}

package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.Instant;
import java.util.Map;

/** What the detector reads from one GPS signal: who sent it, when it was taken and arrived, and where. */
public record Frame(String assetId, String sender, Instant at, Instant arrivedAt, Double latitude,
        Double longitude, Double speedKmh, Boolean engineOn) {

    /** The same frame read at another time. */
    Frame at(Instant time) {
        return new Frame(assetId, sender, time, arrivedAt, latitude, longitude, speedKmh, engineOn);
    }

    public Motion motion() {
        return Motion.of(speedKmh, engineOn);
    }

    /** Arrival minus frame time, in seconds; 0 when the device clock is ahead. */
    public double delaySeconds() {
        return Math.max(0, (arrivedAt.toEpochMilli() - at.toEpochMilli()) / 1000.0);
    }

    private static final String FRAME = "frame";

    /** The frame of a {@code miot.gps.signal@1} map. */
    static Frame of(Map<String, Object> signal, String assetId, Instant at, Instant arrivedAt) {
        Object sender = signal.get("sender");
        return new Frame(assetId, sender instanceof String s && !s.isBlank() ? s : null, at, arrivedAt,
                number(path(signal, FRAME, "gps", "latitude")), number(path(signal, FRAME, "gps", "longitude")),
                number(path(signal, FRAME, "gps", "speed")),
                path(signal, FRAME, "sensors", "engine_status") instanceof Boolean b ? b : null);
    }

    static Object path(Map<String, Object> root, String... keys) {
        Object node = root;
        for (String k : keys) {
            node = node instanceof Map<?, ?> m ? m.get(k) : null;
        }
        return node;
    }

    private static Double number(Object value) {
        return value instanceof Number n ? n.doubleValue() : null;
    }
}

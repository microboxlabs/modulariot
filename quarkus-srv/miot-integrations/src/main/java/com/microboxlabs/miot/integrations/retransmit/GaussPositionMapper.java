package com.microboxlabs.miot.integrations.retransmit;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Map;

/**
 * Maps {@code miot.gps.retransmit@1} outbox payloads to Gauss Control
 * <em>Inyección puntos GPS v2</em> position objects.
 *
 * <p>API body is a JSON array of these objects (even for a single point). See Gauss wiki
 * {@code APG2 / Inyección puntos GPS v2}.
 */
public final class GaussPositionMapper {

    private static final DateTimeFormatter GAUSS_START =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneOffset.UTC);

    private GaussPositionMapper() {}

    /**
     * @param retransmitPayload outbox payload ({@code miot.gps.retransmit@1})
     * @param defaults          tags, deviceType, eventProvider, deviceModel when source lacks them
     */
    public static JsonObject toGaussPosition(JsonObject retransmitPayload, Defaults defaults) {
        if (retransmitPayload == null) {
            throw new IllegalArgumentException("payload is required");
        }
        JsonObject gps = retransmitPayload.getJsonObject("gps");
        if (gps == null) {
            throw new IllegalArgumentException("payload.gps is required");
        }

        String vehicleCode = firstNonBlank(
                retransmitPayload.getString("patent"),
                retransmitPayload.getString("asset_id"),
                "UNKNOWN");
        String vehiclePlate = firstNonBlank(
                retransmitPayload.getString("patent"),
                retransmitPayload.getString("asset_id"));

        JsonObject telecom = retransmitPayload.getJsonObject("telecom");
        String deviceId = firstNonBlank(
                telecom != null ? telecom.getString("iccid") : null,
                retransmitPayload.getString("device_id"),
                "streamhub-" + vehicleCode);

        String eventProvider = firstNonBlank(
                telecom != null ? telecom.getString("gps_provider") : null,
                defaults.eventProvider());

        double lat = requireDouble(gps, "latitude");
        double lon = requireDouble(gps, "longitude");
        double altitude = gps.containsKey("altitude") ? gps.getDouble("altitude") : 0.0;
        double speed = gps.containsKey("speed") ? gps.getDouble("speed") : 0.0;
        int heading = normalizeHeading(gps.getValue("heading"));

        boolean privacy = "privacy".equalsIgnoreCase(retransmitPayload.getString("mode"));
        int ignition = privacy ? 0 : 1;

        JsonObject out = new JsonObject();
        out.put("start", formatStart(retransmitPayload.getValue("timestamp")));
        out.put("vehicleCode", vehicleCode);
        out.put("latitude", lat);
        out.put("longitude", lon);
        out.put("altitude", altitude);
        out.put("speed", speed);
        out.put("tags", normalizeTags(defaults.tags()));
        out.putNull("driverCode");
        out.putNull("ibuttonCode");
        if (vehiclePlate != null) {
            out.put("vehiclePlate", vehiclePlate);
        }
        out.put("deviceType", defaults.deviceType());
        out.put("deviceId", deviceId);
        out.put("headingAngle", heading);
        out.put("eventProvider", eventProvider != null ? eventProvider : defaults.eventProvider());
        out.put("deviceModel", defaults.deviceModel());
        out.put("ignition", ignition);
        // Required by v2; enrichment does not always carry accelerometer — use gravity Z default.
        out.put("accelerometerX", 0.0);
        out.put("accelerometerY", 0.0);
        out.put("accelerometerZ", 9.81);

        if (gps.containsKey("odometer") && gps.getValue("odometer") != null) {
            out.put("odometer", gps.getDouble("odometer"));
        }

        return out;
    }

    /** Gauss expects a JSON array body even for one point. */
    public static JsonArray toGaussBody(JsonObject retransmitPayload, Defaults defaults) {
        return new JsonArray().add(toGaussPosition(retransmitPayload, defaults));
    }

    static String formatStart(Object timestamp) {
        if (timestamp == null) {
            return GAUSS_START.format(Instant.now());
        }
        if (timestamp instanceof Number n) {
            long epoch = n.longValue();
            // Heuristic: ms vs s
            Instant instant = epoch > 1_000_000_000_000L
                    ? Instant.ofEpochMilli(epoch)
                    : Instant.ofEpochSecond(epoch);
            return GAUSS_START.format(instant);
        }
        String raw = String.valueOf(timestamp).trim();
        if (raw.isEmpty()) {
            return GAUSS_START.format(Instant.now());
        }
        // Already Gauss-ish
        if (raw.matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}")) {
            return raw;
        }
        try {
            return GAUSS_START.format(OffsetDateTime.parse(raw).toInstant());
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            return GAUSS_START.format(Instant.parse(raw));
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            LocalDateTime ldt = LocalDateTime.parse(raw, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            return GAUSS_START.format(ldt.toInstant(ZoneOffset.UTC));
        } catch (DateTimeParseException e) {
            return GAUSS_START.format(Instant.now());
        }
    }

    /**
     * Docs: each tag delimited with {@code ;} before and after, e.g. {@code ;MEL;ZALDIVAR;}.
     */
    static String normalizeTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return ";MEL;";
        }
        String t = tags.trim();
        if (!t.startsWith(";")) {
            t = ";" + t;
        }
        if (!t.endsWith(";")) {
            t = t + ";";
        }
        return t;
    }

    static int normalizeHeading(Object heading) {
        if (heading == null) {
            return 0;
        }
        double d = heading instanceof Number n ? n.doubleValue() : Double.parseDouble(String.valueOf(heading));
        int h = (int) Math.round(d) % 360;
        return h < 0 ? h + 360 : h;
    }

    private static double requireDouble(JsonObject obj, String key) {
        Object v = obj.getValue(key);
        if (v == null) {
            throw new IllegalArgumentException("gps." + key + " is required");
        }
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        return Double.parseDouble(String.valueOf(v));
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return null;
    }

    public record Defaults(
            String tags,
            String deviceType,
            String eventProvider,
            String deviceModel) {

        public static Defaults fromConfig(
                String tags, String deviceType, String eventProvider, String deviceModel) {
            return new Defaults(
                    tags == null || tags.isBlank() ? ";MEL;" : tags,
                    deviceType == null || deviceType.isBlank() ? "gps" : deviceType,
                    eventProvider == null || eventProvider.isBlank() ? "streamhub" : eventProvider,
                    deviceModel == null || deviceModel.isBlank() ? "streamhub-miot" : deviceModel);
        }

        public static Defaults ofMap(Map<String, String> map) {
            return fromConfig(
                    map.get("tags"),
                    map.get("deviceType"),
                    map.get("eventProvider"),
                    map.get("deviceModel"));
        }
    }
}

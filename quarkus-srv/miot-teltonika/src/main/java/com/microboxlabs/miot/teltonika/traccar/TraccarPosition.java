package com.microboxlabs.miot.teltonika.traccar;

import cl.streamhub.gps.model.AdditionalInfo;
import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.DriverInfo;
import cl.streamhub.gps.model.Event;
import cl.streamhub.gps.model.Gps;
import cl.streamhub.gps.model.Odometer;
import cl.streamhub.gps.model.Sensors;
import cl.streamhub.gps.model.Telecom;
import cl.streamhub.gps.model.metrics.MetricItem;
import cl.streamhub.gps.model.metrics.MetricQuality;
import cl.streamhub.gps.model.metrics.MetricSource;
import cl.streamhub.gps.model.metrics.MetricsEnvelope;
import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.teltonika.ingest.Candidate;
import com.microboxlabs.miot.teltonika.inputs.InputReading;
import com.microboxlabs.miot.teltonika.mapping.AvlRecordMapper;
import com.microboxlabs.miot.teltonika.monitor.StatusDelta;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * One position Traccar forwards ({@code forward.type=json}: {@code {"position": {...}, "device": {...}}}),
 * translated into the platform's model. Traccar normalizes 200+ protocols to the same attributes:
 * speed in knots, {@code ignition}, {@code sat}, {@code odometer}/{@code totalDistance} (m),
 * {@code power}/{@code battery} (V), {@code rssi}, {@code in1}..{@code in4} or the {@code input} bitmask,
 * {@code adc1}/{@code adc2}, {@code driverUniqueId} and {@code alarm} (comma separated).
 * https://www.traccar.org/documentation/
 */
public record TraccarPosition(String uniqueId, String protocol, Instant fixTime, boolean valid, double latitude,
        double longitude, double altitude, double speedKmh, double course, Map<String, Object> attributes) {

    public static final String IO_METRIC = "x.traccar.io";
    static final double KNOTS_TO_KMH = 1.852;

    /** Traccar alarm → event type of the platform (same names the Teltonika mapping produces). */
    static final Map<String, String> ALARMS = Map.ofEntries(
            Map.entry("overspeed", "speeding"),
            Map.entry("accident", "impact"),
            Map.entry("hardAcceleration", "hard_accel"),
            Map.entry("hardBraking", "hard_brake"),
            Map.entry("hardCornering", "hard_turn"),
            Map.entry("powerCut", "power_unplugged"),
            Map.entry("jamming", "gps_jamming"),
            Map.entry("tow", "towing"),
            Map.entry("sos", "panic_button"),
            Map.entry("tampering", "tamper"),
            Map.entry("door", "door_open"),
            Map.entry("fatigueDriving", "fatigue_alarm"),
            Map.entry("lowBattery", "low_battery"),
            Map.entry("gpsAntennaCut", "gps_antenna_cut"));

    /** Attributes with a field of their own; the rest go to the extension metric as they come. */
    private static final Set<String> NAMED = Set.of("ignition", "sat", "odometer", "totalDistance", "power",
            "battery", "rssi", "driverUniqueId", "alarm", "in1", "in2", "in3", "in4", "input", "adc1", "adc2");

    /** Parses the forwarded body; throws {@link IllegalArgumentException} when it is not a position. */
    public static TraccarPosition parse(JsonNode body) {
        JsonNode p = body == null ? null : body.get("position");
        JsonNode d = body == null ? null : body.get("device");
        if (p == null || d == null || !p.isObject() || !d.isObject()) {
            throw new IllegalArgumentException("expected {\"position\": {...}, \"device\": {...}}");
        }
        String uniqueId = text(d, "uniqueId");
        if (uniqueId == null || uniqueId.isBlank()) {
            throw new IllegalArgumentException("device.uniqueId is required");
        }
        Instant fix = time(p.get("fixTime"));
        if (fix == null) {
            fix = time(p.get("deviceTime"));
        }
        if (fix == null) {
            throw new IllegalArgumentException("position.fixTime is required");
        }
        Map<String, Object> attributes = new LinkedHashMap<>();
        JsonNode attrs = p.get("attributes");
        if (attrs != null && attrs.isObject()) {
            for (Iterator<Map.Entry<String, JsonNode>> it = attrs.fields(); it.hasNext(); ) {
                var e = it.next();
                JsonNode v = e.getValue();
                attributes.put(e.getKey(), v.isBoolean() ? v.booleanValue() : v.isNumber() ? v.numberValue()
                        : v.isNull() ? null : v.asText());
            }
        }
        return new TraccarPosition(uniqueId.trim(), text(p, "protocol"), fix,
                p.path("valid").asBoolean(false), p.path("latitude").asDouble(0), p.path("longitude").asDouble(0),
                p.path("altitude").asDouble(0), p.path("speed").asDouble(0) * KNOTS_TO_KMH, p.path("course").asDouble(0),
                attributes);
    }

    public boolean hasPosition() {
        return com.microboxlabs.miot.teltonika.mapping.AvlRecordMapper.validPosition(latitude, longitude);
    }

    /** Ready for the sink. */
    public Candidate candidate(String gpsProvider, boolean lastKnownPosition) {
        return new Candidate(fixTime, hasPosition(), asset -> payload(asset, gpsProvider, lastKnownPosition),
                inputs());
    }

    /** What it says about the device, for its health. */
    public StatusDelta.Observation observation() {
        Double power = number("power");
        Double battery = number("battery");
        Double rssi = number("rssi");
        return new StatusDelta.Observation(fixTime, hasPosition() ? latitude : null, hasPosition() ? longitude : null,
                valid, integer("sat"), null, rssi == null ? null : rssi.intValue(),
                power == null ? null : (int) Math.round(power * 1000), battery == null ? null : (int) Math.round(battery * 1000),
                null, null, bool("ignition"), driver());
    }

    AssetTrackingData payload(String assetId, String gpsProvider, boolean lastKnownPosition) {
        ZonedDateTime time = fixTime.atZone(ZoneOffset.UTC);
        var data = new AssetTrackingData();
        data.setAssetId(assetId);
        data.setTimestamp(time);
        if (hasPosition() && (valid || lastKnownPosition)) {
            var gps = new Gps();
            gps.setLatitude(latitude);
            gps.setLongitude(longitude);
            gps.setAltitude(altitude);
            gps.setHeading(course);
            gps.setSpeed(Math.round(speedKmh * 10) / 10d);
            Integer sat = integer("sat");
            if (sat != null) {
                gps.setSatellites(sat);
            }
            data.setGps(gps);
        }
        var telecom = new Telecom();
        telecom.setGpsProvider(gpsProvider);
        data.setTelecom(telecom);
        Sensors sensors = sensors();
        if (sensors != null) {
            data.setSensors(sensors);
        }
        String driver = driver();
        if (driver != null) {
            var info = new DriverInfo();
            info.setIdButton(driver);
            data.setDriverInfo(info);
        }
        List<Event> events = events(time);
        if (!events.isEmpty()) {
            data.setEvents(events);
        }
        data.setMetrics(metrics(time));
        return data;
    }

    /** {@code in1}..{@code in4}, or the {@code input} bitmask (bit 0 is input 1); {@code adc1}/{@code adc2} in V. */
    public InputReading inputs() {
        Map<String, Boolean> digital = new HashMap<>();
        Integer mask = integer("input");
        for (int i = 1; i <= 4; i++) {
            Boolean b = bool("in" + i);
            if (b != null) {
                digital.put("din" + i, b);
            } else if (mask != null) {
                digital.put("din" + i, (mask >> (i - 1) & 1) == 1);
            }
        }
        Map<String, Double> analog = new HashMap<>();
        for (int i = 1; i <= 2; i++) {
            Double v = number("adc" + i);
            if (v != null) {
                analog.put("ain" + i, v);
            }
        }
        return new InputReading(digital, analog, null);
    }

    private Sensors sensors() {
        Boolean ignition = bool("ignition");
        Double odometer = number("odometer");
        if (odometer == null) {
            odometer = number("totalDistance");
        }
        if (ignition == null && odometer == null) {
            return null;
        }
        var sensors = new Sensors();
        if (ignition != null) {
            sensors.setEngineStatus(ignition);
        }
        if (odometer != null) {
            var o = new Odometer();
            o.setTotalDistance(odometer / 1000d);
            sensors.setOdometer(o);
        }
        return sensors;
    }

    private List<Event> events(ZonedDateTime time) {
        List<Event> events = new ArrayList<>();
        Object alarm = attributes.get("alarm");
        if (alarm == null) {
            return events;
        }
        for (String a : alarm.toString().split(",")) {
            String type = ALARMS.get(a.trim());
            if (type == null) {
                continue;
            }
            var e = new Event();
            e.setEventType(type);
            e.setTimestamp(time);
            e.setDescription("Traccar alarm " + a.trim() + (protocol == null ? "" : " (" + protocol + ")"));
            if ("speeding".equals(type)) {
                var info = new AdditionalInfo();
                info.setSpeedAtEvent(Math.round(speedKmh * 10) / 10d);
                e.setAdditionalInfo(info);
                e.setThresholdExceeded(true);
            }
            events.add(e);
        }
        return events;
    }

    private MetricsEnvelope metrics(ZonedDateTime time) {
        List<MetricItem> items = new ArrayList<>();
        Double power = number("power");
        if (power != null) {
            items.add(item("battery.voltage", power, "V", time));
        }
        Double odometer = number("odometer");
        if (odometer == null) {
            odometer = number("totalDistance");
        }
        if (odometer != null) {
            items.add(item("vehicle.odometer", odometer / 1000d, "km", time));
        }
        Map<String, Object> io = new LinkedHashMap<>();
        if (protocol != null) {
            io.put("protocol", protocol);
        }
        io.put("valid", valid);
        copy(io, "battery", "battery_voltage_v");
        copy(io, "rssi", "gsm_signal");
        copy(io, "alarm", "alarm");
        inputs().digital().forEach(io::put);
        inputs().analog().forEach((k, v) -> io.put(k + "_v", v));
        attributes.forEach((k, v) -> {
            if (!NAMED.contains(k) && v != null) {
                io.put(k, v);
            }
        });
        items.add(item(IO_METRIC, io, null, time));
        var envelope = new MetricsEnvelope();
        envelope.setSchema(AvlRecordMapper.METRICS_SCHEMA);
        envelope.setDeviceTs(time);
        envelope.setItems(items);
        return envelope;
    }

    private void copy(Map<String, Object> io, String attribute, String name) {
        Object v = attributes.get(attribute);
        if (v != null) {
            io.put(name, v);
        }
    }

    private String driver() {
        Object v = attributes.get("driverUniqueId");
        return v == null || v.toString().isBlank() ? null : v.toString().toUpperCase(Locale.ROOT);
    }

    private Boolean bool(String key) {
        Object v = attributes.get(key);
        if (v instanceof Boolean b) {
            return b;
        }
        if (v instanceof Number n) {
            return n.intValue() != 0;
        }
        if (v instanceof String s && (s.equalsIgnoreCase("true") || s.equalsIgnoreCase("false"))) {
            return Boolean.parseBoolean(s);
        }
        return null;
    }

    private Double number(String key) {
        Object v = attributes.get(key);
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        if (v instanceof String s) {
            try {
                return Double.parseDouble(s);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private Integer integer(String key) {
        Double d = number(key);
        return d == null ? null : d.intValue();
    }

    private static MetricItem item(String key, Object value, String unit, ZonedDateTime time) {
        var item = new MetricItem();
        item.setK(key);
        item.setV(value);
        item.setU(unit);
        item.setTs(time);
        item.setSrc(MetricSource.OEM);
        item.setQ(MetricQuality.OK);
        return item;
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    /** ISO with offset ({@code +00:00} or {@code +0000}), {@code Z}, or epoch milliseconds. */
    static Instant time(JsonNode v) {
        if (v == null || v.isNull()) {
            return null;
        }
        if (v.isNumber()) {
            return Instant.ofEpochMilli(v.longValue());
        }
        String s = v.asText();
        try {
            return OffsetDateTime.parse(s).toInstant();
        } catch (DateTimeParseException e) {
            try {
                return OffsetDateTime.parse(s, DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSZ")).toInstant();
            } catch (DateTimeParseException e2) {
                throw new IllegalArgumentException("unreadable time: " + s);
            }
        }
    }
}

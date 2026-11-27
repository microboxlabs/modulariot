package com.microboxlabs.miot.teltonika.traccar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.Event;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TraccarPositionTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Shape of Traccar's JSON forwarding (forward.type=json). */
    static String body(String uniqueId, boolean valid, String attributes) {
        return """
                {"position":{"id":81,"deviceId":3,"protocol":"gt06","serverTime":"2026-11-16T12:00:05.000+00:00",
                 "deviceTime":"2026-11-16T12:00:00.000+00:00","fixTime":"2026-11-16T12:00:00.000+00:00",
                 "outdated":false,"valid":%s,"latitude":-33.4489,"longitude":-70.6693,"altitude":570.0,
                 "speed":27.0,"course":181.0,"attributes":%s},
                 "device":{"id":3,"name":"camion","uniqueId":"%s","status":"online"}}"""
                .formatted(valid, attributes, uniqueId);
    }

    private static TraccarPosition parse(String json) throws Exception {
        return TraccarPosition.parse(JSON.readTree(json));
    }

    @Test
    void mapsPositionSpeedAndNamedAttributes() throws Exception {
        var pos = parse(body("865028000000001", true, """
                {"ignition":true,"sat":9,"odometer":152340.0,"power":12.6,"battery":4.1,"rssi":4,
                 "driverUniqueId":"00a1b2c3d4","alarm":"overspeed,hardBraking","fuel":55}"""));
        assertEquals(Instant.parse("2026-11-16T12:00:00Z"), pos.fixTime());
        AssetTrackingData d = pos.candidate("Traccar", true).payload().apply("ABCD12");

        assertEquals("ABCD12", d.getAssetId());
        assertEquals(-33.4489, d.getGps().getLatitude());
        assertEquals(50.0, d.getGps().getSpeed(), "27 knots are 50 km/h");
        assertEquals(9, d.getGps().getSatellites());
        assertTrue(d.getSensors().getEngineStatus());
        assertEquals(152.34, d.getSensors().getOdometer().getTotalDistance());
        assertEquals("00A1B2C3D4", d.getDriverInfo().getIdButton());
        assertEquals(List.of("speeding", "hard_brake"), d.getEvents().stream().map(Event::getEventType).toList());
        var io = d.getMetrics().getItems().stream().filter(i -> i.getK().equals(TraccarPosition.IO_METRIC))
                .findFirst().orElseThrow();
        @SuppressWarnings("unchecked")
        Map<String, Object> values = (Map<String, Object>) io.getV();
        assertEquals("gt06", values.get("protocol"));
        assertEquals(55, values.get("fuel"), "unnamed attributes travel as they come");
        assertTrue(d.getMetrics().getItems().stream().allMatch(i -> i.getTs() != null));
    }

    @Test
    void inputsComeFromInFlagsOrTheBitmask() throws Exception {
        var flags = parse(body("865028000000001", true, "{\"in1\":true,\"in2\":false,\"adc1\":12.4}")).inputs();
        assertEquals(Map.of("din1", true, "din2", false), flags.digital());
        assertEquals(Map.of("ain1", 12.4), flags.analog());

        var mask = parse(body("865028000000001", true, "{\"input\":5}")).inputs();
        assertEquals(Map.of("din1", true, "din2", false, "din3", true, "din4", false), mask.digital());
    }

    @Test
    void aPositionWithoutCurrentFixFollowsTheLastKnownSetting() throws Exception {
        var pos = parse(body("865028000000001", false, "{}"));
        assertTrue(pos.candidate("Traccar", true).payload().apply("A").getGps() != null);
        assertNull(pos.candidate("Traccar", false).payload().apply("A").getGps());
        assertFalse(pos.observation().currentFix());
    }

    @Test
    void timesInEveryFormatTraccarUses() throws Exception {
        assertEquals(Instant.parse("2026-11-16T12:00:00Z"), TraccarPosition.time(JSON.readTree("\"2026-11-16T12:00:00Z\"")));
        assertEquals(Instant.parse("2026-11-16T12:00:00Z"),
                TraccarPosition.time(JSON.readTree("\"2026-11-16T09:00:00.000-0300\"")));
        assertEquals(Instant.ofEpochMilli(1700000000000L), TraccarPosition.time(JSON.readTree("1700000000000")));
    }

    @Test
    void somethingElseIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> parse("{\"device\":{\"uniqueId\":\"1\"}}"));
        assertThrows(IllegalArgumentException.class, () -> parse(body("", true, "{}")));
    }
}

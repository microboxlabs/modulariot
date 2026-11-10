package com.microboxlabs.miot.symptoms.cases;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class SpeedLimitTest {

    @Test
    void theMeasureSaysWhichLimitTheSymptomReads() {
        assertEquals("custom", EngineCase.SpeedLimit.source(
                "double(int(signal.frame.gps.speed + 0.5)) - signal.road.maxspeed_custom"));
        assertEquals("road", EngineCase.SpeedLimit.source("signal.frame.gps.speed - signal.road.maxspeed_osm"));
        assertNull(EngineCase.SpeedLimit.source("check.loss.silence_s"));
        assertNull(EngineCase.SpeedLimit.source("signal.road.maxspeed_osm"), "not the speed");
        assertNull(EngineCase.SpeedLimit.source(null));
        assertNull(EngineCase.SpeedLimit.source("signal.frame.gps.speed * signal.road.maxspeed_osm"));
        assertNull(EngineCase.SpeedLimit.source("signal.frame.gps.speed - (signal.road.maxspeed_custom < "
                + "signal.road.maxspeed_osm ? signal.road.maxspeed_custom : signal.road.maxspeed_osm)"));
        assertNull(EngineCase.SpeedLimit.source("signal.frame.gps.speed - signal.road.maxspeed_osm + 10.0"));
        assertEquals("road", EngineCase.SpeedLimit.source("signal.gps.speed_kmh - signal.road.maxspeed_osm"));
    }

    @Test
    void oldTemplatesKeepFractionalSpeedsWhenDerivingTheLimit() {
        String raw = "signal.frame.gps.speed - signal.road.maxspeed_osm";
        assertEquals(68.2, EngineCase.SpeedLimit.ruleSpeed(raw, 68.2));
        assertEquals(new EngineCase.SpeedLimit(50, "road", null),
                EngineCase.SpeedLimit.of("road", null, 68.25, 18.25));
        assertEquals(68.0, EngineCase.SpeedLimit.ruleSpeed(
                "double(int(signal.frame.gps.speed + 0.5)) - signal.road.maxspeed_osm", 68.2));
    }

    @Test
    void anOldChangeDerivesTheLimitAndANonPositiveOneIsNone() throws Exception {
        assertEquals(new EngineCase.SpeedLimit(50, "road", null), EngineCase.SpeedLimit.of("road", null, 68.0, 18.0));
        assertNull(EngineCase.SpeedLimit.of("road", null, 10.0, 18.0));
        assertNull(EngineCase.SpeedLimit.of("road", null, null, 18.0));
        assertNull(EngineCase.SpeedLimit.of(null, null, 68.0, 18.0));
        var kept = new ObjectMapper().readTree("{\"kmh\":50.0,\"road_kmh\":0}");
        assertEquals(new EngineCase.SpeedLimit(50, "road", null), EngineCase.SpeedLimit.of("road", kept, 68.0, 18.0),
                "a kept limit without the one the measure reads falls back to the derivation");
    }
}

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

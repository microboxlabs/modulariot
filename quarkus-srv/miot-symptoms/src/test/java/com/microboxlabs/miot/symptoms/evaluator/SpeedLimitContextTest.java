package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

class SpeedLimitContextTest {

    @Test
    void theRoadLimitAppliesWithoutAnOwnLimit() {
        Map<String, Object> limit = SpeedLimitContext.of(Map.of("road",
                Map.of("maxspeed_osm", 80.0, "osm_way_id", 7L, "road_class", "primary", "custom_zone_id", 3)), "road");
        assertEquals(80.0, limit.get("kmh"));
        assertEquals("road", limit.get("source"));
        assertEquals(80.0, limit.get("road_kmh"));
        assertFalse(limit.containsKey("custom_kmh"));
        assertFalse(limit.containsKey("zone_id"), "the zone only names an own limit");
        assertEquals(7L, limit.get("osm_way_id"));
    }

    @Test
    void anOwnMeasureCarriesItsZone() {
        Map<String, Object> limit = SpeedLimitContext.of(Map.of("road",
                Map.of("maxspeed_osm", 80.0, "maxspeed_custom", 50, "custom_zone_id", 3)), "custom");
        assertEquals(50.0, limit.get("kmh"));
        assertEquals("custom", limit.get("source"));
        assertEquals(3, limit.get("zone_id"));
        assertFalse(limit.containsKey("zone_name"));
    }

    @Test
    void noLimitGivesNone() {
        assertTrue(SpeedLimitContext.of(Map.of(), "road").isEmpty());
        assertTrue(SpeedLimitContext.of(Map.of("road", Map.of("maxspeed_osm", 0.0)), "road").isEmpty());
        assertTrue(SpeedLimitContext.of(null, "road").isEmpty());
    }

    @Test
    void anOsmMeasureKeepsTheRoadLimitEvenInsideACustomZone() {
        Map<String, Object> signal = Map.of("road", Map.of("maxspeed_osm", 80.0, "maxspeed_custom", 50.0,
                "custom_zone_name", "Tramo de prueba"));
        Map<String, Object> limit = SpeedLimitContext.of(signal, "road");
        assertEquals(80.0, limit.get("kmh"));
        assertEquals("road", limit.get("source"));
        assertFalse(limit.containsKey("zone_name"));
        assertTrue(SpeedLimitContext.of(signal, null).isEmpty());
    }
}

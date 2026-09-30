package com.microboxlabs.miot.symptoms.engine;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SymptomEngineTest {

    @Test
    void tenantsMapToTheirEngineClientIds() {
        EngineTenants tenants = EngineTenants.parse(Optional.of(List.of("tenant-a=client-1|client-2", "tenant-b=client-3")));

        assertEquals(List.of("client-1", "client-2"), tenants.clientIds("tenant-a"));
        assertEquals(List.of("client-3"), tenants.clientIds("tenant-b"));
        assertEquals(List.of(), tenants.clientIds("tenant-c"), "an unmapped tenant sees no engine data");
        assertEquals(List.of(), EngineTenants.parse(Optional.empty()).clientIds("tenant-a"));
    }

    @Test
    void malformedTenantEntryFailsAtStartup() {
        Optional<List<String>> entries = Optional.of(List.of("tenant-a"));
        assertThrows(IllegalArgumentException.class, () -> EngineTenants.parse(entries));
    }

    @Test
    @SuppressWarnings("unchecked")
    void signalSampleHasTheSourceShapeAndNoIdentifiers() {
        Map<String, Object> sample = GpsSymptomEngine.signalSample(112.0, 90.0, "HEAVY", 28000.0, "0", 75);

        Map<String, Object> signal = (Map<String, Object>) sample.get("signal");
        assertEquals(112.0, ((Map<String, Object>) signal.get("gps")).get("speed_kmh"));
        assertEquals(90.0, ((Map<String, Object>) signal.get("road")).get("maxspeed_osm"));
        assertEquals("HEAVY", ((Map<String, Object>) signal.get("vehicle")).get("weight_category"));
        assertEquals(false, ((Map<String, Object>) signal.get("geo")).get("authorized_zone"));
        assertEquals(true, ((Map<String, Object>) signal.get("trip")).get("active"));
        assertEquals(75L, sample.get("held_s"));
        assertFalse(sample.toString().contains("plate"));
    }

    @Test
    void demoEngineServesTheSpeedingRule() {
        DemoSymptomEngine demo = new DemoSymptomEngine();

        assertTrue(demo.available());
        assertEquals(DemoSymptomEngine.SPEEDING, demo.rules("any").get(0).name());
        assertEquals(3, demo.recentCases("any", DemoSymptomEngine.SPEEDING, 3).size());
        assertEquals(2, demo.signalSamples("any", 2).size());
        assertEquals(3, demo.levelCounts("any", OffsetDateTime.now().minusDays(7), OffsetDateTime.now()).size());
    }

    @Test
    void unavailableEngineSaysSo() {
        UnavailableSymptomEngine none = new UnavailableSymptomEngine();

        assertFalse(none.available());
        assertTrue(none.rules("any").isEmpty());
    }
}

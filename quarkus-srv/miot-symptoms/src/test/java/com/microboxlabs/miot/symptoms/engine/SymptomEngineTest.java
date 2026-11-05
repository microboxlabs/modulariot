package com.microboxlabs.miot.symptoms.engine;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
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
        for (String bad : List.of("tenant-a", " =client", "tenant=|", "tenant=client|", "tenant=")) {
            Optional<List<String>> entries = Optional.of(List.of(bad));
            assertThrows(IllegalArgumentException.class, () -> EngineTenants.parse(entries), bad);
        }
    }


    @Test
    void unavailableEngineSaysSo() {
        UnavailableSymptomEngine none = new UnavailableSymptomEngine();

        assertFalse(none.available());
        assertTrue(none.rules("any").isEmpty());
    }
}

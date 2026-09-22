package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class SymptomsTenantResolverTest {

    @Test
    void unmappedTenantUsesItsOwnId() {
        var resolver = new SymptomsTenantResolver(Optional.empty());
        assertEquals("tenant-a", resolver.symptomsClientId("tenant-a"));
    }

    @Test
    void mappedTenantUsesTheConfiguredSymptomsClientId() {
        var resolver = new SymptomsTenantResolver(Optional.of(" tenant-a = sym-a , tenant-b=sym-b"));
        assertEquals("sym-a", resolver.symptomsClientId("tenant-a"));
        assertEquals("sym-b", resolver.symptomsClientId("tenant-b"));
        assertEquals("tenant-c", resolver.symptomsClientId("tenant-c"));
    }

    @Test
    void malformedEntryFailsAtBoot() {
        assertThrows(IllegalArgumentException.class, () -> new SymptomsTenantResolver(Optional.of("tenant-a")));
        assertThrows(IllegalArgumentException.class, () -> new SymptomsTenantResolver(Optional.of("=x")));
        assertThrows(IllegalArgumentException.class, () -> new SymptomsTenantResolver(Optional.of("a=")));
    }

    @Test
    void nullTenantIsRejected() {
        var resolver = new SymptomsTenantResolver(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> resolver.symptomsClientId(null));
    }
}

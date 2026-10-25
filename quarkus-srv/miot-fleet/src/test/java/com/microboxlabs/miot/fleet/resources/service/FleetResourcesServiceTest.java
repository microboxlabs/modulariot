package com.microboxlabs.miot.fleet.resources.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class FleetResourcesServiceTest {
    @Test
    void normalizesOnlyAsciiLettersAndDigitsBeforeUppercasing() {
        assertEquals("ABC123", FleetResourcesService.key("abc-123").orElseThrow());
        assertEquals("12", FleetResourcesService.key("ı-12").orElseThrow());
        assertTrue(FleetResourcesService.key("ı - ").isEmpty());
        assertTrue(FleetResourcesService.key(null).isEmpty());
    }
}

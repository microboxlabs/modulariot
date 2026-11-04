package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.*;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RulePresetsTest {
    @Test void departurePresetFindsAFormattedDriverRut() {
        var preset = RulePresets.find(RulePresets.TRIP_DEPARTURE_CALL_PERMISSION).orElseThrow();
        String condition = preset.spec().path("groups").get(0).path("entries").get(0).path("contacts").asText();
        assertTrue(EventCondition.matchesContact(condition, Map.of("data", Map.of("driver", " 12.345.678-5 ")),
                Map.of("nationalId", "123456785")));
        assertTrue(EventCondition.matchesContact(condition, Map.of("data", Map.of("driver", "12.345.678-k")),
                Map.of("nationalId", "12345678K")));
        assertFalse(EventCondition.matchesContact(condition, Map.of("data", Map.of("driver", "12.345.678-5")),
                Map.of("nationalId", "987654321")));
    }
}

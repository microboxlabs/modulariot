package com.microboxlabs.miot.teltonika.profile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ConfigRulesTest {

    @Test
    void validParametersComeBackSortedAndNormalized() {
        var out = ConfigRules.validate(Map.of(10050, " 60", 101, "1", 102, "0", 50020, "2", 50021, "5"));
        assertEquals(List.of(101, 102, 10050, 50020, 50021), List.copyOf(out.keySet()));
        assertEquals("60", out.get(10050));
    }

    @Test
    void frequencyKeepsTheSafeRangesOfRemoteCommands() {
        assertThrows(IllegalArgumentException.class, () -> ConfigRules.validate(Map.of(10050, "1")));
        assertThrows(IllegalArgumentException.class, () -> ConfigRules.validate(Map.of(10000, "86400")));
    }

    @Test
    void serverApnAndKeysAreNeverPartOfAProfile() {
        for (int id : new int[] {2001, 2004, 2005, 2015, 1001}) {
            assertThrows(IllegalArgumentException.class, () -> ConfigRules.validate(Map.of(id, "1")), "param " + id);
        }
    }

    @Test
    void ioSettingsFollowTheirFieldRanges() {
        assertThrows(IllegalArgumentException.class, () -> ConfigRules.validate(Map.of(50000, "3")),
                "priority 0-2: panic is not set from a profile");
        assertThrows(IllegalArgumentException.class, () -> ConfigRules.validate(Map.of(102, "2")),
                "deep sleep drops the data connection");
        assertThrows(IllegalArgumentException.class, () -> ConfigRules.validate(Map.of(50001, "7")), "operand 0-6");
        assertEquals("-500", ConfigRules.validate(Map.of(50003, "-500")).get(50003), "levels may be negative");
        assertThrows(IllegalArgumentException.class, () -> ConfigRules.validate(Map.of(50006, "1")),
                "no seventh field");
        assertThrows(IllegalArgumentException.class, () -> ConfigRules.validate(Map.of(102, "abc")));
        assertThrows(IllegalArgumentException.class, () -> ConfigRules.validate(Map.of()));
    }

    @Test
    void encodedRoundTrip() {
        var p = new ConfigProfile(null, "t", "n", null, "fmb9xx", ConfigRules.validate(Map.of(10050, "60", 102, "1")),
                null, null, null, null);
        assertEquals("102:1;10050:60", p.encoded());
        assertEquals(p.params(), ConfigProfile.decode(p.encoded()));
    }
}

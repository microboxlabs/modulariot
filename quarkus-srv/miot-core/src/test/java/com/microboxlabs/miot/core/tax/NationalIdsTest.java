package com.microboxlabs.miot.core.tax;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;

class NationalIdsTest {

    @Test
    void removesDotsDashesAndSpaces() {
        assertEquals("000000030", NationalIds.normalize("00000003-0"));
        assertEquals("000000030", NationalIds.normalize("00.000.003-0"));
        assertEquals("000000019", NationalIds.normalize("00000001-9"));
        assertEquals("000000019", NationalIds.normalize("00.000.001-9"));
        assertEquals("000000019", NationalIds.normalize(" 00 000 001 - 9 "));
        assertEquals("000000019", NationalIds.normalize("000000019"));
    }

    @Test
    void upperCasesTheVerifier() {
        assertEquals("00000002K", NationalIds.normalize("00.000.002-k"));
        assertEquals("00000002K", NationalIds.normalize("00000002-k"));
        assertEquals("00000002K", NationalIds.normalize("00000002K"));
    }

    @Test
    void unicodeWhitespaceMatchesTheAppsNormalizer() {
        for (String space : List.of("\u00a0", "\u202f", "\u2028", "\u2029", "\ufeff")) {
            assertEquals("00000002K", NationalIds.normalize(space + "00.000.002-k" + space));
            assertNull(NationalIds.normalize(space));
        }
    }

    @Test
    void nullOrBlankIsNull() {
        assertNull(NationalIds.normalize(null));
        assertNull(NationalIds.normalize(""));
        assertNull(NationalIds.normalize("   "));
        assertNull(NationalIds.normalize(" . - \t "));
    }
}

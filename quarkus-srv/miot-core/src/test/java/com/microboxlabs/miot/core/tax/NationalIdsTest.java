package com.microboxlabs.miot.core.tax;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class NationalIdsTest {

    @Test
    void removesDotsDashesAndSpaces() {
        assertEquals("111111111", NationalIds.normalize("11111111-1"));
        assertEquals("111111111", NationalIds.normalize("11.111.111-1"));
        assertEquals("111111111", NationalIds.normalize(" 11 111 111 - 1 "));
        assertEquals("111111111", NationalIds.normalize("111111111"));
    }

    @Test
    void upperCasesTheVerifier() {
        assertEquals("12345678K", NationalIds.normalize("12.345.678-k"));
        assertEquals("12345678K", NationalIds.normalize("12345678K"));
    }

    @Test
    void nullOrBlankIsNull() {
        assertNull(NationalIds.normalize(null));
        assertNull(NationalIds.normalize(""));
        assertNull(NationalIds.normalize("   "));
    }
}

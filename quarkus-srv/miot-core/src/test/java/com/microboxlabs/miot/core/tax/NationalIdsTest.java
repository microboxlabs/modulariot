package com.microboxlabs.miot.core.tax;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class NationalIdsTest {

    @Test
    void removesDotsDashesAndSpaces() {
        assertEquals("123456785", NationalIds.normalize("12345678-5"));
        assertEquals("123456785", NationalIds.normalize("12.345.678-5"));
        assertEquals("111111111", NationalIds.normalize("11111111-1"));
        assertEquals("111111111", NationalIds.normalize("11.111.111-1"));
        assertEquals("111111111", NationalIds.normalize(" 11 111 111 - 1 "));
        assertEquals("111111111", NationalIds.normalize("111111111"));
    }

    @Test
    void upperCasesTheVerifier() {
        assertEquals("1000005K", NationalIds.normalize("1.000.005-k"));
        assertEquals("1000005K", NationalIds.normalize("1000005-k"));
        assertEquals("1000005K", NationalIds.normalize("1000005K"));
    }

    @Test
    void nullOrBlankIsNull() {
        assertNull(NationalIds.normalize(null));
        assertNull(NationalIds.normalize(""));
        assertNull(NationalIds.normalize("   "));
    }
}

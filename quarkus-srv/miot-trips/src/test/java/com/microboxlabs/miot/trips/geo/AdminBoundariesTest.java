package com.microboxlabs.miot.trips.geo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class AdminBoundariesTest {
    private final AdminBoundaries boundaries = new AdminBoundaries();

    @Test
    void namesUseTheSameAccentAndEnyeNormalizationAsDistrictLookup() {
        assertEquals(boundaries.byCode("CL", "13120"), boundaries.namedIn("CL", "Nunoa"));
        assertEquals(boundaries.byCode("CL", "13120"), boundaries.namedIn("CL", "Ñuñoa."));
    }

    @Test
    void theFirstNamedComponentWinsOverTrailingCityAndRegionNames() {
        assertEquals(boundaries.byCode("CL", "13120"), boundaries.namedIn("CL", "Nunoa, Santiago"));
        assertEquals(boundaries.byCode("CL", "13119"), boundaries.namedIn("CL", "Unit 2, Maipu, Santiago"));
        assertTrue(boundaries.namedIn("CL", "No matching district").isEmpty());
    }

    @Test
    void anAmbiguousFirstComponentDoesNotFallBackToATrailingCity() {
        assertTrue(boundaries.namedIn("PE", "Santa Rosa, Lima").isEmpty());
        assertTrue(boundaries.namedIn("CL", null).isEmpty());
        assertTrue(boundaries.namedIn("CL", " ").isEmpty());
    }
}

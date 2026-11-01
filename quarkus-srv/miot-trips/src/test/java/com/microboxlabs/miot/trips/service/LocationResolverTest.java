package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.geo.AdminBoundaries;
import com.microboxlabs.miot.trips.service.LocationResolver.Outcome;
import com.microboxlabs.miot.trips.service.LocationResolver.Site;
import com.microboxlabs.miot.trips.store.FakeAddresses;
import com.microboxlabs.miot.trips.store.FakeGeofences;
import com.microboxlabs.miot.trips.store.InMemoryGeocodeCache;
import org.junit.jupiter.api.Test;

class LocationResolverTest {

    private static final String ORG = "org-a";
    private static final String TENANT = "client-a";
    private static final AdminBoundaries BOUNDARIES = new AdminBoundaries();

    private final FakeGeofences geofences = new FakeGeofences();
    private final LocationResolver resolver = new LocationResolver(geofences, BOUNDARIES, new FakeAddresses(),
            new InMemoryGeocodeCache(), StubGeocoding.none());

    /** Parque Kennedy, Miraflores, Lima (ubigeo 150122). */
    private static Site miraflores(String plusCode, Double lat, Double lon) {
        return new Site("CD-01", "CD Miraflores", "Av. Larco 101", "PE", "150122", null, plusCode, lat, lon);
    }

    @Test
    void aFullPlusCodeInsideTheDistrictResolves() {
        Outcome out = resolver.resolve(ORG, TENANT, miraflores("57V4VXHC+H4", null, null));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals(LocationResolver.PLUS_CODE, out.placement().source());
        assertEquals(-12.1211, out.placement().latitude(), 0.0002);
        assertEquals(-77.0297, out.placement().longitude(), 0.0002);
        assertEquals("57V4VXHC+H4", out.placement().plusCode());
        assertEquals("MIRAFLORES", out.placement().districtName());
        assertNull(out.geofenceId());
    }

    @Test
    void aShortPlusCodeIsRecoveredFromTheDistrictCentroid() {
        Outcome out = resolver.resolve(ORG, TENANT, miraflores("VXHC+H4 Miraflores", null, null));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals("57V4VXHC+H4", out.placement().plusCode());
    }

    @Test
    void aShortPlusCodeWithoutADistrictNeedsReview() {
        Outcome out = resolver.resolve(ORG, TENANT,
                new Site("CD-01", "CD", null, "PE", null, null, "VXHC+H4", null, null));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertEquals("a short plus code needs a district with a boundary", out.placement().note());
    }

    @Test
    void aPointInAnotherDistrictNeedsReviewAndSaysWhere() {
        // Plaza de Armas, Santiago, declared in Providencia
        Outcome out = resolver.resolve(ORG, TENANT,
                new Site("CD-02", "CD", null, "CL", "13123", null, null, -33.4378, -70.6505));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertEquals(LocationResolver.COORDINATES, out.placement().source());
        assertEquals(-33.4378, out.placement().latitude());
        assertEquals("the point is in Santiago (13101), not in Providencia (13123)", out.placement().note());
    }

    @Test
    void aPlusCodeOutsideTheDistrictNeedsReview() {
        Outcome out = resolver.resolve(ORG, TENANT, miraflores("57V4XX34+CV", null, null));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertTrue(out.placement().note().startsWith("the point is in LIMA (150101)"));
    }

    @Test
    void noSourceNeedsReview() {
        Outcome out = resolver.resolve(ORG, TENANT,
                new Site("CD-01", "CD Miraflores", null, "PE", "150122", null, null, null, null));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertEquals("no geofence, plus code or coordinates", out.placement().note());
        assertNull(out.placement().latitude());
        assertNull(out.placement().source());
    }

    @Test
    void coordinatesResolveByDistrictNameIgnoringAccents() {
        Outcome out = resolver.resolve(ORG, TENANT,
                new Site("CD-03", "CD", null, "cl", null, "nunoa", null, -33.4569, -70.5976));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals("13120", out.placement().districtCode());
        assertEquals("Ñuñoa", out.placement().districtName());
    }

    @Test
    void aNameThatRepeatsInTheCountryNeedsTheCode() {
        Outcome out = resolver.resolve(ORG, TENANT,
                new Site("CD-04", "CD", null, "PE", null, "Santa Rosa", null, -12.1, -77.0));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertEquals("district Santa Rosa is ambiguous in PE; send its code", out.placement().note());
    }

    @Test
    void aDistrictWithoutBoundaryNeedsReview() {
        Outcome out = resolver.resolve(ORG, TENANT,
                new Site("CD-05", "CD", null, "PE", "150137", null, null, -12.04, -76.97));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertEquals("district 150137 has no boundary to check against", out.placement().note());
    }

    @Test
    void aGeofenceOfTheTenantWithTheSiteCodeComesFirst() {
        geofences.add("client-b", 7, "CD-01", "CD Miraflores").square(7, -70.65, -33.44, 0.001);
        geofences.add(TENANT, 8, "CD-01", "Otro nombre").square(8, -77.0297, -12.1211, 0.001);

        Outcome out = resolver.resolve(ORG, TENANT, miraflores("57V4XX34+CV", null, null));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals(LocationResolver.GEOFENCE, out.placement().source());
        assertEquals(8, out.geofenceId());
    }

    @Test
    void anotherTenantsGeofenceIsNeverUsed() {
        geofences.add("client-b", 7, "CD-01", "CD Miraflores").square(7, -77.0297, -12.1211, 0.001);

        Outcome out = resolver.resolve(ORG, TENANT, miraflores(null, null, null));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertNull(out.geofenceId());
    }

    @Test
    void aPlusCodeInsideAGeofenceOfTheTenantLinksIt() {
        geofences.add(TENANT, 8, "PARQUE", "Parque Kennedy").square(8, -77.0297, -12.1211, 0.001);

        Outcome out = resolver.resolve(ORG, TENANT, miraflores("57V4VXHC+H4", null, null));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals(LocationResolver.PLUS_CODE, out.placement().source());
        assertEquals(-12.1211, out.placement().latitude(), 0.0002);
        assertEquals(8, out.geofenceId());
    }

    @Test
    void coordinatesInsideSeveralGeofencesLinkTheLowestId() {
        geofences.add(TENANT, 9, "GRANDE", "Zona").square(9, -77.0297, -12.1211, 0.01);
        geofences.add(TENANT, 8, "PARQUE", "Parque Kennedy").square(8, -77.0297, -12.1211, 0.001);
        geofences.add(TENANT, 5, "LEJOS", "Otra").square(5, -70.65, -33.44, 0.001);

        Outcome out = resolver.resolve(ORG, TENANT, miraflores(null, -12.1211, -77.0297));

        assertEquals(LocationResolver.COORDINATES, out.placement().source());
        assertEquals(8, out.geofenceId());
    }

    @Test
    void aPointInsideAnotherTenantsGeofenceLinksNothing() {
        geofences.add("client-b", 7, "PARQUE", "Parque Kennedy").square(7, -77.0297, -12.1211, 0.001);

        Outcome out = resolver.resolve(ORG, TENANT, miraflores("57V4VXHC+H4", null, null));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertNull(out.geofenceId());
    }

    @Test
    void aPointInsideAGeofenceButOutsideTheDistrictLinksNothing() {
        geofences.add(TENANT, 8, "CENTRO", "Lima centro").square(8, -77.0298, -12.0464, 0.01);

        Outcome out = resolver.resolve(ORG, TENANT, miraflores("57V4XX34+CV", null, null));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertNull(out.geofenceId());
    }

    @Test
    void aPointJustOutsideASimplifiedBorderStillResolves() {
        // Providencia's centroid, nudged 200 m past the district's border is still within the slack
        AdminBoundaries.Boundary providencia = BOUNDARIES.byCode("CL", "13123").orElseThrow();
        var c = providencia.centroid();
        double lon = c.get(0);
        while (providencia.shape().contains(lon, c.get(1))) {
            lon += 0.0001;
        }
        lon += 200 / (111_320 * Math.cos(Math.toRadians(c.get(1))));

        Outcome out = resolver.resolve(ORG, TENANT, new Site("CD-06", "CD", null, "CL", "13123", null, null, c.get(1), lon));

        assertEquals(Location.RESOLVED, out.placement().status());
    }

    @Test
    void aManualPointSkipsGeofencesAndIsTaggedManual() {
        geofences.add(TENANT, 8, "CD-01", "CD Miraflores").square(8, -77.0297, -12.1211, 0.001);
        geofences.add(TENANT, 9, "PARQUE", "Parque Kennedy").square(9, -77.0297, -12.1211, 0.001);

        Outcome out = resolver.place(miraflores(null, -12.1211, -77.0297));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals(LocationResolver.MANUAL, out.placement().source());
        assertNull(out.geofenceId());
    }

    @Test
    void anInvalidPlusCodeFallsBackToCoordinates() {
        Outcome out = resolver.resolve(ORG, TENANT, miraflores("NOT-A-CODE", -12.1211, -77.0297));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals(LocationResolver.COORDINATES, out.placement().source());
    }

    @Test
    void codesThatLostTheirLeadingZerosArePadded() {
        assertEquals("06204", BOUNDARIES.normalizeCode("CL", "6204"));
        assertEquals("010101", BOUNDARIES.normalizeCode("PE", "10101"));
        assertNull(BOUNDARIES.normalizeCode("PE", "15O122"));
    }

    /** Av. Presidente Jorge Alessandri Rodríguez 10700, San Bernardo, as the internal table spells it. */
    private static final double SB_LON = -70.69898;
    private static final double SB_LAT = -33.55113;

    private LocationResolver withAddresses(FakeAddresses table) {
        return new LocationResolver(geofences, BOUNDARIES, table, new InMemoryGeocodeCache(), StubGeocoding.none());
    }

    private static FakeAddresses sanBernardo() {
        return new FakeAddresses().add("SAN BERNARDO", "PRESIDENTE JORGE ALESSANDRI RODRÍGUEZ", "10700", SB_LON, SB_LAT)
                .add("SAN BERNARDO", "LOS AROMOS", "10700", -70.70, -33.60);
    }

    private static Site written(String address) {
        return new Site(address, null, address, "CL", null, null, null, null, null);
    }

    @Test
    void anAddressWithoutTitleOrAccentsMatchesTheInternalStreetByWords() {
        Outcome out = withAddresses(sanBernardo()).resolve(ORG, TENANT,
                new Site("SITE", null, "Av. Jorge Alessandri Rodriguez 10700", "CL", "13401", null, null, null, null));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals(LocationResolver.INTERNAL, out.placement().source());
        assertEquals(SB_LAT, out.placement().latitude(), 1e-9);
    }

    @Test
    void anAddressAloneTakesTheCommuneItNames() {
        Outcome out = withAddresses(sanBernardo()).resolve(ORG, TENANT,
                written("Av. Jorge Alessandri 10700, San Bernardo"));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals(LocationResolver.INTERNAL, out.placement().source());
        assertEquals("13401", out.placement().districtCode());
    }

    @Test
    void anAddressAloneWithoutCommuneIsFoundAcrossTheCountry() {
        Outcome out = withAddresses(sanBernardo()).resolve(ORG, TENANT, written("Pdte J. Alessandri R. 10700"));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals(LocationResolver.INTERNAL, out.placement().source());
        assertEquals("13401", out.placement().districtCode());
    }

    @Test
    void theSameStreetAndNumberInTwoCommunesNeedsTheCommune() {
        FakeAddresses table = sanBernardo()
                .add("MAIPÚ", "PRESIDENTE JORGE ALESSANDRI RODRÍGUEZ", "10700", -70.75, -33.51);

        Outcome out = withAddresses(table).resolve(ORG, TENANT, written("Jorge Alessandri 10700"));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertEquals("the address names no district and is not in the internal addresses", out.placement().note());
        assertEquals(Location.RESOLVED, withAddresses(table).resolve(ORG, TENANT,
                written("Jorge Alessandri 10700, Maipú")).placement().status());
    }

    @Test
    void anAddressAloneInsideAGeofenceLinksIt() {
        geofences.add(TENANT, 1205, "SCL", "Patio").square(1205, SB_LON, SB_LAT, 0.003);

        Outcome out = withAddresses(sanBernardo()).resolve(ORG, TENANT,
                written("Av. Jorge Alessandri 10700, San Bernardo"));

        assertEquals(1205, out.geofenceId());
    }

    @Test
    void aCommuneAfterUnitDetailsDisambiguatesTheInternalStreet() {
        FakeAddresses table = new FakeAddresses()
                .add("SAN BERNARDO", "ALPHA", "123", SB_LON, SB_LAT)
                .add("SANTIAGO", "ALPHA", "123", -70.6505, -33.4378);

        Outcome out = withAddresses(table).resolve(ORG, TENANT, written("Alpha 123 Depto 2 San Bernardo"));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals("13401", out.placement().districtCode());
    }

    @Test
    void theNamedCommuneWinsOverTheTrailingCity() {
        FakeAddresses table = new FakeAddresses()
                .add("ÑUÑOA", "ALPHA", "123", -70.5976, -33.4569)
                .add("SANTIAGO", "ALPHA", "123", -70.6505, -33.4378);

        Outcome out = withAddresses(table).resolve(ORG, TENANT, written("Alpha 123, Nunoa, Santiago"));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals("13120", out.placement().districtCode());
    }

    @Test
    void differentStreetTypesWithTheSameWordsAreAmbiguous() {
        FakeAddresses table = new FakeAddresses()
                .add("SAN BERNARDO", "CALLE ALPHA", "123", SB_LON, SB_LAT)
                .add("SAN BERNARDO", "PASAJE ALPHA", "123", SB_LON + 0.001, SB_LAT);

        assertEquals(Location.NEEDS_REVIEW, withAddresses(table).resolve(ORG, TENANT,
                written("Alpha 123, San Bernardo")).placement().status());
    }

    @Test
    void anIncompleteCandidateSetCannotResolveWithinACommuneOrAcrossTheCountry() {
        FakeAddresses table = new FakeAddresses().add("SAN BERNARDO", "ALPHA", "123", SB_LON, SB_LAT);
        for (int i = 0; i < 999; i++) {
            table.add("SAN BERNARDO", "OTHER", "123", SB_LON, SB_LAT);
        }
        assertEquals(Location.RESOLVED, withAddresses(table).resolve(ORG, TENANT,
                written("Alpha 123")).placement().status());
        table.add("SAN BERNARDO", "CALLE ALPHA", "123", SB_LON + 0.001, SB_LAT);

        for (String address : java.util.List.of("Alpha 123", "Alpha 123, San Bernardo")) {
            assertEquals(Location.NEEDS_REVIEW, withAddresses(table).resolve(ORG, TENANT,
                    written(address)).placement().status());
        }
    }
}

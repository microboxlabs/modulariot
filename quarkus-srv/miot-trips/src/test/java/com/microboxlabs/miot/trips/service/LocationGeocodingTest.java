package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.geocoding.AllowAllGeocodingGate;
import com.microboxlabs.miot.core.geocoding.GeocodingGate;
import com.microboxlabs.miot.integrations.geocoding.GeocodingConnection;
import com.microboxlabs.miot.integrations.geocoding.GeocodingMetrics;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.geo.AdminBoundaries;
import com.microboxlabs.miot.trips.service.LocationResolver.Outcome;
import com.microboxlabs.miot.trips.service.LocationResolver.Site;
import com.microboxlabs.miot.trips.store.FakeAddresses;
import com.microboxlabs.miot.trips.store.FakeGeofences;
import com.microboxlabs.miot.trips.store.GeocodeCache;
import com.microboxlabs.miot.trips.store.InMemoryGeocodeCache;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** Steps 4 and 5 of the resolver: the internal source, the shared cache and the provider, against a stub. */
class LocationGeocodingTest {

    private static final String ORG = "org-a";
    private static final String TENANT = "client-a";
    private static final AdminBoundaries BOUNDARIES = new AdminBoundaries();
    private static final double LARCO_LON = -77.0297;
    private static final double LARCO_LAT = -12.1211;
    /** Plaza de Armas de Lima, district 150101. */
    private static final double LIMA_LON = -77.0300;
    private static final double LIMA_LAT = -12.0453;

    private final StubGeocoding stub = new StubGeocoding();
    private final InMemoryGeocodeCache cache = new InMemoryGeocodeCache();
    private final FakeAddresses addresses = new FakeAddresses()
            .add("PROVIDENCIA", "PROVIDENCIA", "1234", -70.6110, -33.4263);

    private LocationResolver resolver() {
        return new LocationResolver(new FakeGeofences(), BOUNDARIES, addresses, cache, stub.geocoder());
    }

    /** Refuses every provider call and remembers who asked. */
    private final List<String> asked = new ArrayList<>();
    private final GeocodingGate exhausted = (organization, tenantCode) -> {
        asked.add(organization + "/" + tenantCode);
        return new GeocodingGate.Refusal("geocoding_quota_exhausted",
                "the organization used its 1000 geocoding resolutions for this month");
    };

    private LocationResolver resolver(GeocodingGate gate, GeocodingMetrics metrics) {
        return new LocationResolver(new FakeGeofences(), BOUNDARIES, addresses, cache, stub.geocoder(), gate,
                metrics);
    }

    @AfterEach
    void stop() {
        stub.close();
    }

    private static Site larco(String address) {
        return new Site("CD-01", "CD Miraflores", address, "PE", "150122", null, null, null, null);
    }

    @Test
    void aProviderRefusalTakesPriorityOverInvalidPointInput() {
        Outcome out = resolver(exhausted, new GeocodingMetrics(new io.micrometer.core.instrument.simple.SimpleMeterRegistry())).resolve(ORG, TENANT,
                new Site("synthetic", "Synthetic site", "Synthetic street 101", "PE", "150122", null, "INVALID", null, null));
        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertTrue(out.placement().note().contains("1000 geocoding resolutions"));
        assertTrue(stub.queries.isEmpty());
    }

    @Test
    void sameNamedDistrictsHaveSeparateCacheEntries() {
        stub.answer(StubGeocoding.features("address", LARCO_LON, LARCO_LAT));
        resolver().resolve(ORG, TENANT, larco("Synthetic street 101"));
        var other = BOUNDARIES.byName("PE", "MIRAFLORES").stream()
                .filter(b -> !b.code().equals("150122") && b.shape() != null).findFirst().orElseThrow();
        stub.answer(StubGeocoding.features("address", other.centroid().get(0), other.centroid().get(1)));
        Outcome out = resolver().resolve(ORG, TENANT, new Site("other", "Synthetic location", "Synthetic street 101", "PE", other.code(), null, null, null, null));
        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals(2, stub.queries.size());
        assertEquals(2, cache.entries.size());
    }

    @Test
    void cacheWriteFailureKeepsTheResolvedPointAndAccounting() {
        stub.answer(StubGeocoding.features("address", LARCO_LON, LARCO_LAT));
        GeocodeCache unavailable = new GeocodeCache() {
            @Override public java.util.Optional<Entry> find(String key, String country) { return java.util.Optional.empty(); }
            @Override public void put(String key, String country, Entry entry) { throw new IllegalStateException("synthetic cache failure"); }
        };
        LocationResolver resolver = new LocationResolver(new FakeGeofences(), BOUNDARIES, addresses, unavailable, stub.geocoder());
        Outcome out = resolver.resolve(ORG, TENANT, larco("Synthetic street 101"));
        assertEquals(Location.RESOLVED, out.placement().status());
        assertTrue(out.usage().called());
        assertEquals(new BigDecimal("0.00075"), out.usage().costUsd());
    }

    @Test
    void anAddressLevelResultInTheDistrictResolvesAndIsCached() {
        stub.answer(StubGeocoding.features("address", LARCO_LON, LARCO_LAT));

        Outcome out = resolver().resolve(ORG, TENANT, larco("Av. Larco 101"));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals(LocationResolver.PROVIDER, out.placement().source());
        assertEquals(LARCO_LAT, out.placement().latitude());
        assertEquals("mapbox", out.usage().provider());
        assertTrue(out.usage().called());
        assertFalse(out.usage().cacheHit());
        assertEquals(new BigDecimal("0.00075"), out.usage().costUsd());
        assertTrue(stub.queries.get(0).contains("q=Av.+Larco+101%2C+MIRAFLORES"));
        assertTrue(stub.queries.get(0).contains("permanent=true"));
        assertTrue(stub.queries.get(0).contains("country=pe"));
        GeocodeCache.Entry entry = cache.entries.get("PE|150122|AV LARCO 101 MIRAFLORES");
        assertEquals(LARCO_LON, entry.lon());
        assertEquals("mapbox", entry.provider());
        assertEquals(LocationResolver.PROVIDER, entry.source());
    }

    @Test
    void theSameAddressIsServedFromTheCacheWithoutACall() {
        stub.answer(StubGeocoding.features("address", LARCO_LON, LARCO_LAT));
        resolver().resolve(ORG, TENANT, larco("Av. Larco 101"));

        Outcome again = resolver().resolve("org-b", "client-b", new Site("X", "Otro sitio", "AV LARCO 101", "PE",
                "150122", null, null, null, null));

        assertEquals(1, stub.queries.size());
        assertEquals(Location.RESOLVED, again.placement().status());
        assertEquals(LocationResolver.PROVIDER, again.placement().source());
        assertTrue(again.usage().cacheHit());
        assertFalse(again.usage().called());
        assertNull(again.usage().costUsd());
        assertEquals("mapbox", again.usage().provider());
    }

    @Test
    void aStreetLevelResultNeedsReviewAndIsNotCached() {
        stub.answer(StubGeocoding.features("street", LARCO_LON, LARCO_LAT, "place", LARCO_LON, LARCO_LAT));

        Outcome out = resolver().resolve(ORG, TENANT, larco("Av. Larco"));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertEquals("mapbox found only street, not an address", out.placement().note());
        assertNull(out.placement().latitude());
        assertTrue(out.usage().called());
        assertTrue(cache.entries.isEmpty());
    }

    @Test
    void anAddressOutsideTheDistrictNeedsReviewAndIsNotCached() {
        stub.answer(StubGeocoding.features("address", LIMA_LON, LIMA_LAT));

        Outcome out = resolver().resolve(ORG, TENANT, larco("Av. Larco 101"));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertEquals(LocationResolver.PROVIDER, out.placement().source());
        assertTrue(out.placement().note().startsWith("the point is in LIMA (150101)"), out.placement().note());
        assertTrue(cache.entries.isEmpty());
    }

    @Test
    void theFirstAddressInsideTheDistrictIsTaken() {
        stub.answer(StubGeocoding.features("address", LIMA_LON, LIMA_LAT, "address", LARCO_LON, LARCO_LAT));

        Outcome out = resolver().resolve(ORG, TENANT, larco("Av. Larco 101"));

        assertEquals(Location.RESOLVED, out.placement().status());
        assertEquals(LARCO_LON, out.placement().longitude());
    }

    @Test
    void googleResultsWithoutStoragePermissionNeedReview() {
        stub.metadata(GeocodingConnection.PROVIDER, "google")
                .answer(StubGeocoding.results("street_address", LARCO_LON, LARCO_LAT));

        Outcome out = resolver().resolve(ORG, TENANT, larco("Av. Larco 101"));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertNull(out.placement().latitude());
        assertNull(out.placement().longitude());
        assertNull(out.geofenceId());
        assertEquals("google", out.usage().provider());
        assertTrue(cache.entries.isEmpty());
    }

    @Test
    void aTemporaryMapboxConnectionNeedsReview() {
        stub.metadata(GeocodingConnection.PERMANENT, "false")
                .answer(StubGeocoding.features("address", LARCO_LON, LARCO_LAT));

        Outcome out = resolver().resolve(ORG, TENANT, larco("Av. Larco 101"));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertNull(out.placement().latitude());
        assertNull(out.placement().longitude());
        assertNull(out.geofenceId());
        assertTrue(cache.entries.isEmpty());
    }

    @Test
    void theInternalSourceResolvesAChileanAddressWithoutAProvider() {
        Outcome out = resolver().resolve(ORG, TENANT, new Site("S-1", "Oficina", "Avenida Providencia 1234, Of. 501",
                "CL", "13123", null, null, null, null));

        assertEquals(Location.RESOLVED, out.placement().status(), out.placement().note());
        assertEquals(LocationResolver.INTERNAL, out.placement().source());
        assertEquals(-33.4263, out.placement().latitude());
        assertTrue(stub.queries.isEmpty());
        assertNull(out.usage().provider());
        assertTrue(cache.entries.isEmpty());
    }

    @Test
    void aChileanAddressTheInternalSourceDoesNotHaveGoesToTheProvider() {
        stub.answer(StubGeocoding.features("address", -70.6110, -33.4263));

        Outcome out = resolver().resolve(ORG, TENANT, new Site("S-1", "Oficina", "Avenida Providencia 999", "CL",
                "13123", null, null, null, null));

        assertEquals(LocationResolver.PROVIDER, out.placement().source());
        assertEquals(1, stub.queries.size());
    }

    @Test
    void aPlusCodeIsUsedBeforeTheAddress() {
        Outcome out = resolver().resolve(ORG, TENANT, new Site("CD-01", "CD", "Av. Larco 101", "PE", "150122", null,
                "57V4VXHC+H4", null, null));

        assertEquals(LocationResolver.PLUS_CODE, out.placement().source());
        assertTrue(stub.queries.isEmpty());
        assertFalse(out.usage().called());
    }

    @Test
    void withoutADistrictTheProviderIsNotAsked() {
        Outcome out = resolver().resolve(ORG, TENANT, new Site("CD-01", "CD", "Av. Larco 101", "PE", null, null, null,
                null, null));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertEquals("an address needs a district with a boundary to be geocoded", out.placement().note());
        assertTrue(stub.queries.isEmpty());
    }

    @Test
    void withoutItsOwnConnectionTheSiteNeedsReview() {
        Outcome out = new LocationResolver(new FakeGeofences(), BOUNDARIES, addresses, cache, StubGeocoding.none())
                .resolve("org-c", TENANT, larco("Av. Larco 101"));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertEquals("geocoding: this organization has no geocoding connection; a platform owner adds it in"
                + " Conexiones", out.placement().note());
        assertFalse(out.usage().called());
        assertTrue(stub.queries.isEmpty());
    }

    @Test
    void anExhaustedQuotaSendsTheSiteToReviewWithoutCallingTheProvider() {
        stub.answer(StubGeocoding.features("address", LARCO_LON, LARCO_LAT));

        Outcome out = resolver(exhausted, new GeocodingMetrics(new io.micrometer.core.instrument.simple.SimpleMeterRegistry())).resolve(ORG, TENANT, larco("Av. Larco 101"));

        assertEquals(Location.NEEDS_REVIEW, out.placement().status());
        assertEquals("geocoding: the organization used its 1000 geocoding resolutions for this month",
                out.placement().note());
        assertTrue(stub.queries.isEmpty());
        assertFalse(out.usage().called());
        assertNull(out.usage().costUsd());
        assertEquals(List.of(ORG + "/" + TENANT), asked);
    }

    @Test
    void freeSourcesDoNotAskTheGate() {
        stub.answer(StubGeocoding.features("address", LARCO_LON, LARCO_LAT));
        resolver().resolve(ORG, TENANT, larco("Av. Larco 101"));
        LocationResolver gated = resolver(exhausted, new GeocodingMetrics(new io.micrometer.core.instrument.simple.SimpleMeterRegistry()));

        Outcome cached = gated.resolve(ORG, TENANT, larco("Av. Larco 101"));
        Outcome internal = gated.resolve(ORG, TENANT, new Site("S-1", "Oficina", "Avenida Providencia 1234", "CL",
                "13123", null, null, null, null));
        Outcome plusCode = gated.resolve(ORG, TENANT, new Site("CD-01", "CD", "Av. Larco 101", "PE", "150122", null,
                "57V4VXHC+H4", null, null));

        assertEquals(Location.RESOLVED, cached.placement().status());
        assertEquals(LocationResolver.INTERNAL, internal.placement().source());
        assertEquals(LocationResolver.PLUS_CODE, plusCode.placement().source());
        assertTrue(asked.isEmpty());
    }

    @Test
    void cacheLookupsAreMetered() {
        SimpleMeterRegistry meters = new SimpleMeterRegistry();
        LocationResolver metered = resolver(new AllowAllGeocodingGate(), new GeocodingMetrics(meters));
        stub.answer(StubGeocoding.features("address", LARCO_LON, LARCO_LAT));

        metered.resolve(ORG, TENANT, larco("Av. Larco 101"));
        metered.resolve(ORG, TENANT, larco("Av. Larco 101"));

        assertEquals(1.0, meters.get("geocoding.cache.lookups").tags("result", "miss").counter().count());
        assertEquals(1.0, meters.get("geocoding.cache.lookups").tags("result", "hit").counter().count());
    }
}

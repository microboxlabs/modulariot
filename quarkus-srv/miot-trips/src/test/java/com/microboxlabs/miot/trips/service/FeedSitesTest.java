package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Location.Placement;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest.Site;
import java.util.List;
import org.junit.jupiter.api.Test;

class FeedSitesTest {

    private static final Site LARCO = new Site("Av. Larco 101", "PE", "150122", null, null, null, null);

    private static Location location(Integer geofenceId, Placement placement) {
        return new Location("id-1", "client-a", "CD-01", "zone", "CD-01", null, geofenceId, null, null, null, null,
                placement);
    }

    private static Placement placement(String address, String status) {
        return new Placement(address, "PE", "150122", null, null, null, null, null, status, null);
    }

    @Test
    void unexpectedFeedFailuresDoNotExposeInternalDiagnostics() {
        LocationService locations = new LocationService(null, null, null, null, null, null) {
            @Override public java.util.Optional<Location> byCode(String tenant, String code) {
                throw new IllegalStateException("synthetic private-db.example diagnostics");
            }
        };
        FeedServiceRequest desired = new FeedServiceRequest("service", "synthetic", "CD-01", "CD-02", null, null, null,
                null, null, null, null, null, null, null, LARCO, null);
        List<String> result = new FeedSites(locations, null).locate("synthetic-org", "client-a", "synthetic-actor", desired);
        assertEquals(List.of("CD-01: could not resolve site"), result);
        assertFalse(result.toString().contains("private-db"));
    }

    @Test
    void aDestinationOnlySiteWithTheSameCodeIsResolved() {
        java.util.List<com.microboxlabs.miot.trips.dto.LocationResolveRequest> calls = new java.util.ArrayList<>();
        LocationService locations = new LocationService(null, null, null, null, null, null) {
            @Override public java.util.Optional<Location> byCode(String tenant, String code) {
                return java.util.Optional.of(location(null, Placement.NONE));
            }
        };
        LocationResolutionService resolution = new LocationResolutionService(null, null, null, null, null, null, null, null, null) {
            @Override public Location resolve(String organization, String tenant, String actor, com.microboxlabs.miot.trips.dto.LocationResolveRequest request) {
                calls.add(request);
                return location(42, placement(request.address(), Location.RESOLVED));
            }
        };
        FeedServiceRequest desired = new FeedServiceRequest("service", "synthetic", "CD-01", "CD-01", null, null, null,
                null, null, null, null, null, null, null, null, LARCO);
        assertEquals(List.of("CD-01: resolved"), new FeedSites(locations, resolution).locate("org-synthetic", "client-a", "synthetic-actor", desired));
        assertEquals(1, calls.size());
        assertEquals(LARCO.address(), calls.get(0).address());
    }

    @Test
    void correctedCountryAndDistrictRetryReviewSites() {
        Placement noCountry = new Placement(LARCO.address(), null, "150122", null, null, null, null, null, Location.NEEDS_REVIEW, null);
        assertTrue(FeedSites.due(location(null, noCountry), LARCO));
        Placement unknownDistrict = new Placement(LARCO.address(), "PE", "150122", "Unrecognized district", null, null, null, null, Location.NEEDS_REVIEW, null);
        assertTrue(FeedSites.due(location(null, unknownDistrict), new Site(LARCO.address(), "PE", "150122", "Miraflores", null, null, null)));
    }

    @Test
    void equivalentOrOmittedDeclaredFieldsDoNotRepeatTheResolution() {
        Placement saved = new Placement(LARCO.address(), "PE", "150122", "MIRAFLORES", null, null, null, null, Location.NEEDS_REVIEW, null);
        assertFalse(FeedSites.due(location(null, saved), new Site(null, " pe ", null, "miraflores", null, null, null)));
    }

    @Test
    void aLocationNeverTriedIsLocated() {
        assertTrue(FeedSites.due(location(null, Placement.NONE), LARCO));
    }

    @Test
    void aResolvedRejectedOrLinkedLocationIsLeftAsItIs() {
        assertFalse(FeedSites.due(location(null, placement("Av. Larco 101", Location.RESOLVED)), LARCO));
        assertFalse(FeedSites.due(location(null, placement("Av. Larco 101", Location.REJECTED)), LARCO));
        assertFalse(FeedSites.due(location(42, Placement.NONE), LARCO));
    }

    @Test
    void aLocationInReviewIsTriedAgainOnlyWithADifferentSite() {
        Location inReview = location(null, placement("Av. Larco 101", Location.NEEDS_REVIEW));

        assertFalse(FeedSites.due(inReview, LARCO));
        assertTrue(FeedSites.due(inReview, new Site("Av. Larco 345", "PE", "150122", null, null, null, null)));
        assertTrue(FeedSites.due(inReview, new Site("Av. Larco 101", "PE", "150122", null, "57X8+QJ", null, null)));
        assertTrue(FeedSites.due(inReview, new Site("Av. Larco 101", "PE", "150122", null, null, -12.12, -77.03)));
    }

    @Test
    void aServiceWithoutSitesLocatesNothing() {
        FeedSites sites = new FeedSites(null, null);
        FeedServiceRequest desired = new FeedServiceRequest("service", "ref", "CD-01", "CD-02", null, null, null,
                null);

        assertEquals(List.of(), sites.locate("org-a", "client-a", "feed:test", desired));
        assertEquals(List.of(), sites.locate("org-a", "client-a", "feed:test", null));
    }
}

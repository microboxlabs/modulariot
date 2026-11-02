package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.openlocationcode.OpenLocationCode;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.integrations.geocoding.GeocodingMetrics;
import com.microboxlabs.miot.integrations.service.GeocodeUsageService;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Location.Placement;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest.Site;
import com.microboxlabs.miot.trips.dto.LocationResolveRequest;
import com.microboxlabs.miot.trips.geo.AdminBoundaries;
import com.microboxlabs.miot.trips.store.FakeAddresses;
import com.microboxlabs.miot.trips.store.FakeGeofences;
import com.microboxlabs.miot.trips.store.InMemoryFleet;
import com.microboxlabs.miot.trips.store.InMemoryGeocodeCache;
import com.microboxlabs.miot.trips.store.InMemoryTripsWorld;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
        List<String> result = new FeedSites(locations, null).locate("synthetic-org", "client-a", "synthetic-actor", null, desired);
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
        assertEquals(List.of("CD-01: resolved"), new FeedSites(locations, resolution).locate("org-synthetic", "client-a", "synthetic-actor", null, desired));
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

        assertEquals(List.of(), sites.locate("org-a", "client-a", "feed:test", null, desired));
        assertEquals(List.of(), sites.locate("org-a", "client-a", "feed:test", null, null));
    }

    @Test
    void addressCellsUseTheFeedCountryWithoutADistrict() {
        Capture capture = new Capture();
        var desired = row("  Alpha 123  ", "Beta 456", null, null);

        assertEquals(List.of("Alpha 123: resolved", "Beta 456: resolved"),
                capture.locate("CL", desired));
        assertEquals(List.of("  Alpha 123  ", "Beta 456"), capture.lookupCodes);
        assertEquals(List.of("Alpha 123", "Beta 456"),
                capture.calls.stream().map(LocationResolveRequest::address).toList());
        for (LocationResolveRequest request : capture.calls) {
            assertEquals("CL", request.country());
            assertNull(request.districtCode());
            assertNull(request.district());
            assertNull(request.plusCode());
        }
    }

    @Test
    void onlyShortPlusCodeCellsUseTheFeedCountry() {
        for (String code : List.of("57X8+QJ", "57x8+qj Miraflores", "57V45Q7F+9V")) {
            Capture capture = new Capture();
            assertEquals(List.of(code + ": resolved"), capture.locate("PE", row(code, "SCL", null, null)));
            LocationResolveRequest request = capture.calls.getFirst();
            assertEquals(code.split(" ")[0].toUpperCase(java.util.Locale.ROOT), request.plusCode());
            assertEquals(new OpenLocationCode(request.plusCode()).isShort() ? "PE" : null, request.country());
            assertNull(request.address());
            assertNull(request.districtCode());
            assertNull(request.district());
        }
    }

    @Test
    void plainCodesAndTextWithoutAddressPartsAreSkipped() {
        Capture capture = new Capture();
        for (String code : List.of("SCL", "GEO-PROV-ORIGEN-1", "Providencia", "Av Providencia", "123 456", "")) {
            assertEquals(List.of(), capture.locate("CL", row(code, null, null, null)));
        }
        assertEquals(0, capture.lookups);
        assertTrue(capture.calls.isEmpty());
    }

    @Test
    void withoutACountryOnlyFullPlusCodesAreInferred() {
        Capture capture = new Capture();
        for (String code : List.of("Av. Larco 101", "57X8+QJ", "57X8+QJ Miraflores")) {
            assertEquals(List.of(), capture.locate(null, row(code, null, null, null)));
        }
        assertEquals(0, capture.lookups);
        assertEquals(List.of("57V45Q7F+9V: resolved"),
                capture.locate(null, row("57V45Q7F+9V", null, null, null)));
        assertEquals("57V45Q7F+9V", capture.calls.getFirst().plusCode());
        assertNull(capture.calls.getFirst().country());
    }

    @Test
    void anExplicitSiteWinsOverTheCellAndFeedCountry() {
        Capture capture = new Capture();
        capture.locate("CL", row("Av Providencia 1234", "SCL", LARCO, null));
        assertEquals(1, capture.calls.size());
        assertEquals(LARCO.address(), capture.calls.getFirst().address());
        assertEquals("PE", capture.calls.getFirst().country());
        assertEquals("150122", capture.calls.getFirst().districtCode());
    }

    @Test
    void anExplicitDestinationSiteWinsWhenBothCellsNameTheSameLocation() {
        Capture capture = new Capture();
        capture.locate("CL", row("Av Providencia 1234", "Av Providencia 1234", null, LARCO));
        assertEquals(1, capture.calls.size());
        assertEquals(LARCO.address(), capture.calls.getFirst().address());
    }

    @Test
    void inferredSitesRespectResolutionAndReviewState() {
        Capture capture = new Capture();
        for (Location saved : List.of(location(42, Placement.NONE),
                location(null, placement("previous address", Location.RESOLVED)),
                location(null, placement("previous address", Location.REJECTED)),
                location(null, new Placement("Av Providencia 1234", "CL", null, null,
                        null, null, null, null, Location.NEEDS_REVIEW, null)))) {
            capture.saved = saved;
            assertEquals(List.of(), capture.locate("CL", row("Av Providencia 1234", null, null, null)));
        }
        assertTrue(capture.calls.isEmpty());
    }

    @Test
    void unchangedShortCodesDoNotRepeatPlacementOrAuditAfterRealResolution() {
        InMemoryTripsWorld world = new InMemoryTripsWorld();
        FakeGeofences geofences = new FakeGeofences();
        TripLiveProjector live = world.projector(new InMemoryFleet());
        AuditService audit = new AuditService(world.auditStore);
        LocationService locations = new LocationService(world.locationStore, geofences, world.tripStore,
                live, audit, Transactions.none());
        LocationResolver resolver = new LocationResolver(geofences, new AdminBoundaries(), new FakeAddresses(),
                new InMemoryGeocodeCache(), StubGeocoding.none());
        GeocodeUsageService usage = new GeocodeUsageService(null, null, GeocodingMetrics.NONE) {
            @Override public void recordResolution(Resolution resolution) {
                // This test checks placement and audit writes.
            }
        };
        LocationResolutionService resolution = new LocationResolutionService(world.locationStore, locations,
                resolver, geofences, world.tripStore, live, audit, Transactions.none(), usage);
        FeedSites sites = new FeedSites(locations, resolution);
        String code = "57X8+QJ";
        locations.resolve("client-a", "feed:test", code);
        FeedServiceRequest desired = row(code, null, null, null);

        assertEquals(List.of(code + ": needs_review"), sites.locate("org-a", "client-a", "feed:test", "PE", desired));
        Location saved = locations.byCode("client-a", code).orElseThrow();
        assertEquals(code, saved.placement().plusCode());
        assertEquals(Location.NEEDS_REVIEW, saved.placement().status());
        assertNull(saved.placement().latitude());
        assertNull(saved.placement().longitude());
        int writes = world.auditTrail().size();

        assertEquals(List.of(), sites.locate("org-a", "client-a", "feed:test", "PE", desired));
        assertEquals(writes, world.auditTrail().size());
        assertEquals(saved, locations.byCode("client-a", code).orElseThrow());
        assertEquals(List.of(code + ": needs_review"), sites.locate("org-a", "client-a", "feed:test", "CL", desired));
        assertEquals(writes + 1, world.auditTrail().size());
    }

    @Test
    void aDeclaredGeofenceOfTheOrganizationResolvesTheLocationAtItsCenterWithoutADistrict() {
        InMemoryTripsWorld world = new InMemoryTripsWorld();
        FakeGeofences geofences = new FakeGeofences()
                .add("client-a", 501, "G-501", "Synthetic yard").square(501, -70.30, -23.77, 0.01)
                .add("client-b", 777, "G-777", "Another client's yard").square(777, -70.40, -23.60, 0.01);
        TripLiveProjector live = world.projector(new InMemoryFleet());
        AuditService audit = new AuditService(world.auditStore);
        LocationService locations = new LocationService(world.locationStore, geofences, world.tripStore,
                live, audit, Transactions.none());
        LocationResolver resolver = new LocationResolver(geofences, new AdminBoundaries(), new FakeAddresses(),
                new InMemoryGeocodeCache(), StubGeocoding.none());
        List<GeocodeUsageService.Resolution> recorded = new ArrayList<>();
        GeocodeUsageService usage = new GeocodeUsageService(null, null, GeocodingMetrics.NONE) {
            @Override public void recordResolution(Resolution resolution) {
                recorded.add(resolution);
            }
        };
        LocationResolutionService resolution = new LocationResolutionService(world.locationStore, locations,
                resolver, geofences, world.tripStore, live, audit, Transactions.none(), usage);
        FeedSites sites = new FeedSites(locations, resolution);
        locations.resolve("client-a", "feed:test", "Synthetic yard");
        locations.resolve("client-a", "feed:test", "Other yard");
        FeedServiceRequest desired = row("Synthetic yard", "Other yard",
                new Site(null, null, null, null, null, -23.7, -70.3, 501),
                new Site(null, null, null, null, null, null, null, 777));

        List<String> located = sites.locate("org-a", "client-a", "feed:test", null, desired);

        assertEquals("Synthetic yard: resolved", located.get(0));
        assertEquals("Other yard: geofence 777 is not the organization's", located.get(1));
        Location yard = locations.byCode("client-a", "Synthetic yard").orElseThrow();
        assertEquals(501, yard.geofenceId());
        assertEquals(Location.RESOLVED, yard.placement().status());
        assertEquals(LocationResolver.GEOFENCE, yard.placement().source());
        assertEquals(-23.77, yard.placement().latitude(), 1e-6);
        assertEquals(-70.30, yard.placement().longitude(), 1e-6);
        assertNull(locations.byCode("client-a", "Other yard").orElseThrow().geofenceId());
        GeocodeUsageService.Resolution use = recorded.stream()
                .filter(r -> LocationResolver.GEOFENCE.equals(r.source())).findFirst().orElseThrow();
        assertEquals("org-a", use.organization());
        assertFalse(use.providerCalled(), "a declared geofence is counted, not charged");

        assertFalse(sites.locate("org-a", "client-a", "feed:test", null, desired).stream()
                .anyMatch(s -> s.startsWith("Synthetic yard")), "a linked location keeps its geofence");

        Location other = locations.byCode("client-a", "Other yard").orElseThrow();
        resolution.reject("client-a", "reviewer", java.util.UUID.fromString(other.id()), "not a place");
        Location kept = resolution.useGeofence("org-a", "client-a", "feed:test", java.util.UUID.fromString(other.id()),
                501);
        assertEquals(Location.REJECTED, kept.placement().status(), "a review decision taken meanwhile stays");
        assertNull(kept.geofenceId());
    }

    @Test
    void aDeclaredGeofenceLeavesReviewedLocationsAsTheyAre() {
        assertTrue(FeedSites.geofenceDue(location(null, Placement.NONE)));
        assertTrue(FeedSites.geofenceDue(location(null, placement("x", Location.NEEDS_REVIEW))));
        assertFalse(FeedSites.geofenceDue(location(42, Placement.NONE)));
        assertFalse(FeedSites.geofenceDue(location(null, placement("x", Location.RESOLVED))));
        assertFalse(FeedSites.geofenceDue(location(null, placement("x", Location.REJECTED))));
    }

    private static FeedServiceRequest row(String origin, String destination, Site originSite, Site destinationSite) {
        return new FeedServiceRequest("service", "ref", origin, destination, null, null, null, null, null,
                null, null, null, null, null, originSite, destinationSite);
    }

    private static class Capture {
        private final List<LocationResolveRequest> calls = new ArrayList<>();
        private Location saved = location(null, Placement.NONE);
        private int lookups;
        private final List<String> lookupCodes = new ArrayList<>();
        private final LocationService locations = new LocationService(null, null, null, null, null, null) {
            @Override public Optional<Location> byCode(String tenant, String code) {
                assertEquals("client-a", tenant);
                lookups++;
                lookupCodes.add(code);
                return Optional.of(saved);
            }
        };
        private final LocationResolutionService resolution = new LocationResolutionService(
                null, null, null, null, null, null, null, null, null) {
            @Override public Location resolve(String organization, String tenant, String actor,
                    LocationResolveRequest request) {
                assertEquals("org-a", organization);
                assertEquals("client-a", tenant);
                assertEquals("feed:test", actor);
                calls.add(request);
                return location(42, placement(request.address(), Location.RESOLVED));
            }
        };

        private List<String> locate(String country, FeedServiceRequest desired) {
            return new FeedSites(locations, resolution).locate("org-a", "client-a", "feed:test", country, desired);
        }
    }
}

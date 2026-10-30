package com.microboxlabs.miot.trips.access;

import com.microboxlabs.miot.trips.api.OrgLocationsResource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Subscription;
import com.microboxlabs.miot.integrations.geocoding.GeocodingEvents;
import com.microboxlabs.miot.integrations.geocoding.GeocodingMetrics;
import com.microboxlabs.miot.integrations.persistence.GeocodeUsageRepository;
import com.microboxlabs.miot.integrations.persistence.GeocodingPlanRepository;
import com.microboxlabs.miot.integrations.persistence.GeocodeUsageRepository.UsageRow;
import com.microboxlabs.miot.integrations.service.GeocodeUsageService;
import com.microboxlabs.miot.integrations.service.GeocodingPlanService;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.dto.LocationPointRequest;
import com.microboxlabs.miot.trips.dto.LocationRejectRequest;
import com.microboxlabs.miot.trips.dto.LocationResolveResult;
import com.microboxlabs.miot.trips.dto.LocationView;
import com.microboxlabs.miot.trips.geo.AdminBoundaries;
import com.microboxlabs.miot.trips.geo.GeoShape;
import com.microboxlabs.miot.trips.service.AuditService;
import com.microboxlabs.miot.trips.service.LocationResolutionService;
import com.microboxlabs.miot.trips.service.LocationResolver;
import com.microboxlabs.miot.trips.service.LocationService;
import com.microboxlabs.miot.trips.service.StubGeocoding;
import com.microboxlabs.miot.trips.service.TripLiveProjector;
import com.microboxlabs.miot.trips.store.FakeAddresses;
import com.microboxlabs.miot.trips.store.FakeGeofences;
import com.microboxlabs.miot.trips.store.GeofenceDirectory.Geofence;
import com.microboxlabs.miot.trips.store.InMemoryFleet;
import com.microboxlabs.miot.trips.store.InMemoryGeocodeCache;
import com.microboxlabs.miot.trips.store.InMemoryTripsWorld;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;

class OrgLocationsResourceTest {

    private static final String ORG = "acme";
    private static final String TENANT = "client-a";
    private static final AdminBoundaries BOUNDARIES = new AdminBoundaries();
    private static final ObjectMapper JSON = new ObjectMapper();

    private final InMemoryTripsWorld world = new InMemoryTripsWorld();
    private final FakeGeofences geofences = new FakeGeofences();
    private final List<UsageRow> usage = new ArrayList<>();
    private final OrgLocationsResource resource = resource();

    /** No organization has a geocoding subscription; nothing is enforced. */
    private static GeocodingPlanService noPlan() {
        return new GeocodingPlanService(new GeocodingPlanRepository(null) {
            @Override
            public Subscription subscription(String organization) {
                return null;
            }
        }, new GeocodingEvents(e -> CompletableFuture.completedFuture(null)), GeocodingMetrics.NONE, false);
    }

    private OrgLocationsResource resource() {
        return resource(geofences, world.projector(new InMemoryFleet()));
    }

    private OrgLocationsResource resource(com.microboxlabs.miot.trips.store.GeofenceDirectory fences, TripLiveProjector live) {
        AuditService audit = new AuditService(world.auditStore);
        LocationService locations = new LocationService(world.locationStore, fences, world.tripStore, live, audit,
                Transactions.none());
        LocationResolutionService resolution = new LocationResolutionService(world.locationStore, locations,
                new LocationResolver(fences, BOUNDARIES, new FakeAddresses(), new InMemoryGeocodeCache(),
                        StubGeocoding.none()),
                fences, world.tripStore, live, audit, Transactions.none(),
                new GeocodeUsageService(new GeocodeUsageRepository(null) {
                    @Override
                    public void insert(UsageRow r) {
                        usage.add(r);
                    }
                }, noPlan(), GeocodingMetrics.NONE));
        return new OrgLocationsResource(null, null, null, null, locations, resolution) {
            @Override
            protected String tenantCode(String org) {
                return TENANT;
            }

            @Override
            protected String actor() {
                return "ops@example.com";
            }
        };
    }

    private static Response await(io.smallrye.mutiny.Uni<Response> uni) {
        return uni.await().atMost(Duration.ofSeconds(10));
    }

    private static JsonNode json(String text) {
        try {
            return JSON.readTree(text);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void oneSiteResolvesAndGetsAGeofenceOfTheTenantSizedByType() {
        Response r = await(resource.resolve(ORG, json("""
                {"externalCode": "CD-01", "name": "CD Miraflores", "type": "distribution_center",
                 "address": "Av. Larco 101", "country": "PE", "districtCode": "150122",
                 "plusCode": "VXHC+H4"}""")));

        assertEquals(200, r.getStatus());
        LocationView view = (LocationView) r.getEntity();
        assertEquals(Location.RESOLVED, view.resolutionStatus());
        assertEquals("plus_code", view.resolutionSource());
        assertEquals("MIRAFLORES", view.district());
        List<Geofence> created = geofences.of(TENANT);
        assertEquals(1, created.size());
        assertEquals(created.get(0).id(), view.geofenceId());
        assertEquals("CD-01", created.get(0).code());
        GeoShape area = GeoShape.parse(geofences.shape(view.geofenceId()));
        assertTrue(area.contains(view.longitude(), view.latitude()));
        double radius = area.distanceMeters(view.longitude(), view.latitude());
        assertEquals(300, radius, 5);
    }

    @Test
    void aBatchResolvesEachSiteOnItsOwn() {
        Response r = await(resource.resolve(ORG, json("""
                [{"externalCode": "A", "type": "customer", "country": "CL", "districtCode": "13123",
                  "latitude": -33.4263, "longitude": -70.61},
                 {"externalCode": "B", "type": "customer", "country": "CL", "districtCode": "13123",
                  "latitude": -33.4378, "longitude": -70.6505},
                 {"locationId": "not-a-uuid"}]""")));

        assertEquals(200, r.getStatus());
        @SuppressWarnings("unchecked")
        List<LocationResolveResult> results = (List<LocationResolveResult>) r.getEntity();
        assertEquals(3, results.size());
        assertEquals(Location.RESOLVED, results.get(0).location().resolutionStatus());
        assertEquals(Location.NEEDS_REVIEW, results.get(1).location().resolutionStatus());
        assertNull(results.get(1).location().geofenceId());
        assertEquals("locationId must be a UUID", results.get(2).error());
        assertEquals(1, geofences.of(TENANT).size(), "a site in review gets no geofence");
        assertEquals(List.of(
                new UsageRow(ORG, TENANT, "ops@example.com", "coordinates", "resolved", null, false, false, null),
                new UsageRow(ORG, TENANT, "ops@example.com", "coordinates", "needs_review", null, false, false,
                        null)), usage,
                "one usage row per resolution, none for a site that failed before it");
    }

    @Test
    void sitesInReviewAreListedByStatus() {
        await(resource.resolve(ORG, json("""
                [{"externalCode": "A", "country": "PE", "districtCode": "150122", "plusCode": "57V4VXHC+H4"},
                 {"externalCode": "B", "country": "PE", "districtCode": "150122"}]""")));

        @SuppressWarnings("unchecked")
        List<LocationView> review = (List<LocationView>) await(
                resource.list(ORG, null, null, "needs_review", null, null)).getEntity();
        assertEquals(List.of("B"), review.stream().map(LocationView::externalCode).toList());
        assertEquals(400, await(resource.list(ORG, null, null, "pending", null, null)).getStatus());
    }

    @Test
    void aPointSetByHandIsCheckedThenGetsItsGeofence() {
        LocationView site = (LocationView) await(resource.resolve(ORG, json("""
                {"externalCode": "B", "type": "port", "country": "CL", "district": "Providencia"}""")))
                .getEntity();
        assertEquals(Location.NEEDS_REVIEW, site.resolutionStatus());

        Response outside = await(resource.place(ORG, site.id(),
                new LocationPointRequest(null, null, null, null, -33.4378, -70.6505)));
        assertEquals(400, outside.getStatus());
        assertTrue(geofences.of(TENANT).isEmpty());

        Response placed = await(resource.place(ORG, site.id(),
                new LocationPointRequest(null, null, null, "47RFH9FR+F2", null, null)));
        assertEquals(200, placed.getStatus());
        LocationView view = (LocationView) placed.getEntity();
        assertEquals(Location.RESOLVED, view.resolutionStatus());
        assertEquals("manual", view.resolutionSource());
        assertNotNull(view.geofenceId());
        assertEquals(1000, GeoShape.parse(geofences.shape(view.geofenceId()))
                .distanceMeters(view.longitude(), view.latitude()), 15);
    }

    @Test
    void withoutTheGpsDatabaseAResolvedPointStaysInReview() {
        geofences.unconfigured();

        LocationView view = (LocationView) await(resource.resolve(ORG, json("""
                {"externalCode": "A", "country": "PE", "districtCode": "150122", "plusCode": "57V4VXHC+H4"}""")))
                .getEntity();

        assertEquals(Location.NEEDS_REVIEW, view.resolutionStatus());
        assertEquals("the GPS database is not configured", view.resolutionNote());
        assertEquals(-12.1211, view.latitude(), 0.0002);
    }

    @Test
    void anExistingGeofenceIsLinkedWithoutCreatingAnother() {
        geofences.add(TENANT, 42, "CD-01", "CD Miraflores").square(42, -77.0297, -12.1211, 0.001);

        LocationView view = (LocationView) await(resource.resolve(ORG, json("""
                {"externalCode": "CD-01", "country": "PE", "districtCode": "150122"}"""))).getEntity();

        assertEquals(Location.RESOLVED, view.resolutionStatus());
        assertEquals("geofence", view.resolutionSource());
        assertEquals(42, view.geofenceId());
        assertEquals(1, geofences.of(TENANT).size());
    }

    @Test
    void aSiteCanBeRejected() {
        LocationView site = (LocationView) await(resource.resolve(ORG, json("""
                {"externalCode": "X", "country": "PE"}"""))).getEntity();

        Response r = await(resource.reject(ORG, site.id(), new LocationRejectRequest("not a real site")));

        assertEquals(200, r.getStatus());
        assertEquals(Location.REJECTED, ((LocationView) r.getEntity()).resolutionStatus());
        assertEquals("not a real site", ((LocationView) r.getEntity()).resolutionNote());
    }

    @Test
    void aBodyThatIsNotASiteIsABadRequest() {
        assertEquals(400, await(resource.resolve(ORG, json("\"CD-01\""))).getStatus());
        assertEquals(400, await(resource.resolve(ORG, json("[]"))).getStatus());
        assertEquals(400, await(resource.resolve(ORG, json("{\"latitude\": \"north\"}"))).getStatus());
        assertEquals(404, await(resource.place(ORG, "11111111-1111-1111-1111-111111111111",
                new LocationPointRequest(null, null, null, null, -12.1, -77.0))).getStatus());
    }

    @Test
    void malformedBatchItemsDoNotPreventValidSitesFromResolving() {
        Response response = await(resource.resolve(ORG, json("""
                [{"externalCode":"batch-a","country":"PE","districtCode":"150122","plusCode":"57V4VXHC+H4"},
                 {"latitude":"north"},
                 {"externalCode":"batch-c","country":"PE","districtCode":"150122","plusCode":"57V4VXHC+H4"}]""")));
        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        List<LocationResolveResult> results = (List<LocationResolveResult>) response.getEntity();
        assertEquals(3, results.size());
        assertEquals(Location.RESOLVED, results.get(0).location().resolutionStatus());
        assertNull(results.get(1).location());
        assertNotNull(results.get(1).error());
        assertEquals(Location.RESOLVED, results.get(2).location().resolutionStatus());
    }

    @Test
    void aDistrictOnlyRetryKeepsTheSavedPoint() {
        LocationView first = (LocationView) await(resource.resolve(ORG, json("""
                {"externalCode":"retry-a","country":"PE","plusCode":"57V4VXHC+H4"}"""))).getEntity();
        assertEquals(Location.NEEDS_REVIEW, first.resolutionStatus());
        LocationView second = (LocationView) await(resource.resolve(ORG, json("""
                {"externalCode":"retry-a","districtCode":"150122"}"""))).getEntity();
        assertEquals(Location.RESOLVED, second.resolutionStatus());
        assertEquals(first.latitude(), second.latitude());
        assertEquals(first.longitude(), second.longitude());
    }

    @Test
    void aReplacementDistrictNameDoesNotKeepTheOldCode() {
        LocationView first = (LocationView) await(resource.resolve(ORG, json("""
                {"externalCode":"district-a","country":"CL","districtCode":"13101"}"""))).getEntity();
        Response placed = await(resource.place(ORG, first.id(),
                new LocationPointRequest(null, null, "Providencia", null, -33.4316, -70.6090)));
        assertEquals(200, placed.getStatus());
        LocationView second = (LocationView) placed.getEntity();
        assertEquals(Location.RESOLVED, second.resolutionStatus());
        assertEquals("13123", second.districtCode());
    }

    @Test
    void movingAManualPointKeepsSharedGeofencesAndMovesItsOwnArea() {
        LocationView first = (LocationView) await(resource.resolve(ORG, json("""
                {"externalCode":"manual-a","country":"CL","district":"Providencia","latitude":-33.4316,"longitude":-70.6090}"""))).getEntity();
        String originalArea = geofences.shape(first.geofenceId());
        Response placed = await(resource.place(ORG, first.id(),
                new LocationPointRequest(null, null, null, null, -33.4330, -70.6080)));
        assertEquals(200, placed.getStatus());
        LocationView second = (LocationView) placed.getEntity();
        double[] point = com.microboxlabs.miot.trips.geo.GeoShape.parse(geofences.shape(second.geofenceId())).center();
        assertEquals(-70.6080, point[0], 0.00001);
        assertEquals(-33.4330, point[1], 0.00001);
        assertEquals(originalArea, geofences.shape(first.geofenceId()));
        Response moved = await(resource.place(ORG, first.id(),
                new LocationPointRequest(null, null, null, null, -33.4320, -70.6075)));
        assertEquals(200, moved.getStatus());
        LocationView third = (LocationView) moved.getEntity();
        assertEquals(second.geofenceId(), third.geofenceId());
        double[] changed = com.microboxlabs.miot.trips.geo.GeoShape.parse(geofences.shape(third.geofenceId())).center();
        assertEquals(-70.6075, changed[0], 0.00001);
        assertEquals(-33.4320, changed[1], 0.00001);
    }

    @Test
    void unexpectedBackendErrorsDoNotAbortLaterBatchSitesOrExposeDiagnostics() {
        FakeGeofences unreliable = new FakeGeofences() {
            @Override
            public List<Geofence> matching(String tenant, String code, String name, int limit) {
                if ("broken".equals(code)) throw new RuntimeException("synthetic internal-db.example diagnostics");
                return super.matching(tenant, code, name, limit);
            }
        };
        OrgLocationsResource endpoint = resource(unreliable, world.projector(new InMemoryFleet()));
        Response response = await(endpoint.resolve(ORG, json("""
                [{"externalCode":"first","country":"PE","districtCode":"150122","plusCode":"57V4VXHC+H4"},
                 {"externalCode":"broken","country":"PE","districtCode":"150122","plusCode":"57V4VXHC+H4"},
                 {"externalCode":"last","country":"PE","districtCode":"150122","plusCode":"57V4VXHC+H4"}]""")));
        assertEquals(200, response.getStatus());
        @SuppressWarnings("unchecked")
        List<LocationResolveResult> results = (List<LocationResolveResult>) response.getEntity();
        assertEquals(Location.RESOLVED, results.get(0).location().resolutionStatus());
        assertEquals("could not resolve site", results.get(1).error());
        assertEquals(Location.RESOLVED, results.get(2).location().resolutionStatus());
    }

    @Test
    void invalidContextValuesBecomeReviewInsteadOfFailingPersistenceValidation() {
        var body = JSON.createObjectNode().put("externalCode", "invalid-context").put("country", "PERU")
                .put("districtCode", "1".repeat(17)).put("district", "x".repeat(256))
                .put("latitude", -12.1211).put("longitude", -77.03);
        Response response = await(resource.resolve(ORG, body));
        assertEquals(200, response.getStatus());
        LocationView site = (LocationView) response.getEntity();
        assertEquals(Location.NEEDS_REVIEW, site.resolutionStatus());
        assertNull(site.country());
        assertNull(site.districtCode());
        assertNull(site.district());
        assertNotNull(site.resolutionNote());
        assertNull(site.geofenceId());
    }

    @Test
    void resolvingTheSameLinkStillRefreshesLiveTripsAfterAnUnlockedRead() {
        java.util.concurrent.atomic.AtomicInteger refreshes = new java.util.concurrent.atomic.AtomicInteger();
        TripLiveProjector live = new TripLiveProjector(null, null, null, null, null, null, null) {
            @Override
            public void refreshAll(String tenant, java.util.Collection<java.util.UUID> ids) {
                assertEquals(TENANT, tenant);
                refreshes.incrementAndGet();
            }
        };
        OrgLocationsResource endpoint = resource(geofences, live);
        JsonNode body = json("""
                {"externalCode":"refresh-a","country":"CL","district":"Providencia","latitude":-33.4316,"longitude":-70.6090}""");
        LocationView first = (LocationView) await(endpoint.resolve(ORG, body)).getEntity();
        LocationView second = (LocationView) await(endpoint.resolve(ORG, body)).getEntity();
        assertEquals(first.geofenceId(), second.geofenceId());
        assertEquals(2, refreshes.get());
    }
}

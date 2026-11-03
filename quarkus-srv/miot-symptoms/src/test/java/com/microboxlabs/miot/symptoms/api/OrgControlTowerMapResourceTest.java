package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.service.DemoSeeder;
import com.microboxlabs.miot.symptoms.service.TreatmentService;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import com.microboxlabs.miot.symptoms.store.InMemoryContactStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseService;
import com.microboxlabs.miot.symptoms.cases.InMemoryEngineCases;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.gps.SignalStates;
import com.microboxlabs.miot.core.gps.SignalStates.SignalState;
import com.microboxlabs.miot.core.gps.SignalStates.Status;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.ServiceAccountTokenIssuer.IssuedToken;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import com.microboxlabs.miot.symptoms.map.ControlTowerMapService;
import com.microboxlabs.miot.symptoms.map.ControlTowerTreatmentService;
import com.microboxlabs.miot.symptoms.map.GpsRpcApi;
import com.microboxlabs.miot.symptoms.map.TreatmentReads;
import com.microboxlabs.miot.symptoms.map.TripWindows;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The organization's own client id reaches the GPS database, and failures are 400 or 503. */
class OrgControlTowerMapResourceTest {

    private static final String ORG = "org-a";
    private static final Duration WAIT = Duration.ofSeconds(5);
    private static final ObjectMapper JSON = new ObjectMapper();

    private final List<String> tokensAskedFor = new ArrayList<>();
    private GpsRpcApi.RpcResponse response = new GpsRpcApi.RpcResponse(200, "ok",
            JSON.createObjectNode().put("Stable", 3));

    private final GpsRpcApi rpc = new GpsRpcApi() {
        @Override
        public Uni<RpcResponse> positions(String authorization, boolean all) {
            gpsCalls.add("positions");
            return Uni.createFrom().item(response);
        }

        @Override
        public Uni<RpcResponse> summary(String authorization) {
            gpsCalls.add("summary");
            return Uni.createFrom().item(response);
        }

        @Override
        public Uni<RpcResponse> conditions(String authorization, String from, String to) {
            gpsCalls.add("conditions");
            return Uni.createFrom().item(response);
        }

        @Override
        public Uni<JsonNode> symptoms(String authorization, Map<String, String> filters) {
            gpsCalls.add("symptoms");
            sentFilters.add(filters);
            JsonNode page = JSON.createObjectNode().put("total_rows", 1).set("data",
                    JSON.createArrayNode().add(JSON.createObjectNode().put("asset_id", "AB12")));
            return Uni.createFrom().item(page);
        }
    };

    private final List<Map<String, String>> sentFilters = new ArrayList<>();
    private final List<String> gpsCalls = new ArrayList<>();

    private static final class Roles extends OrganizationRoleService {
        private final Set<String> permissions;

        Roles(Set<String> permissions) {
            super(null, null, null);
            this.permissions = permissions;
        }

        @Override
        public Uni<Access> access(String organizationSlug, Caller caller) {
            return Uni.createFrom().item(new Access(1L, organizationSlug, BaseRole.MEMBER, Set.of(), permissions));
        }
    }

    private OrgControlTowerMapResource resource(Optional<String> url) {
        return resource(url, Set.of(ControlTowerAccessCatalog.VIEW));
    }

    private OrgControlTowerMapResource resource(Optional<String> url, Set<String> permissions) {
        return resource(url, permissions, null);
    }

    private OrgControlTowerMapResource resource(Optional<String> url, Set<String> permissions,
            com.microboxlabs.miot.core.trips.TripGeofences tripGeofences) {
        return resource(url, permissions, tripGeofences, null, true);
    }

    private OrgControlTowerMapResource resource(Optional<String> url, Set<String> permissions,
            com.microboxlabs.miot.core.trips.TripGeofences tripGeofences, boolean legacy) {
        return resource(url, permissions, tripGeofences, null, legacy);
    }

    private OrgControlTowerMapResource resource(Optional<String> url, Set<String> permissions,
            com.microboxlabs.miot.core.trips.TripGeofences tripGeofences, SignalStates signals) {
        return resource(url, permissions, tripGeofences, signals, true);
    }

    private OrgControlTowerMapResource resource(Optional<String> url, Set<String> permissions,
            com.microboxlabs.miot.core.trips.TripGeofences tripGeofences, SignalStates signals, boolean legacy) {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        org.setUserEmail("member@example.com");
        TenantContext tenant = new TenantContext();
        tenant.setClientId("client-a");
        ControlTowerMapService map = new ControlTowerMapService(clientId -> {
            tokensAskedFor.add(clientId);
            return Uni.createFrom().item(new IssuedToken("t", Instant.now().plusSeconds(3600)));
        }, url, () -> rpc);
        tenant.setEffectiveClientIds(List.of("client-a", "client-child"));
        return new OrgControlTowerMapResource(tenant, org, new Roles(permissions), null, map,
                new ControlTowerTreatmentService(treatmentReads), new EngineCaseService(engineCases,
                        (t, a, d) -> { }, t -> null, java.time.Clock.systemUTC()),
                new TreatmentService(treatments, contacts, new DemoSeeder(false, contacts, treatments),
                        new AuditService(new InMemoryAuditStore())),
                new TripWindows((tenantCode, trip, asset) -> moduleTrips.getOrDefault(trip + "/" + asset,
                        Optional.empty()), java.time.Clock.fixed(NOW, java.time.ZoneOffset.UTC)),
                geofences(tripGeofences), instance(signals), java.time.Clock.fixed(NOW, java.time.ZoneOffset.UTC), legacy);
    }

    @SuppressWarnings("unchecked")
    private static <T> jakarta.enterprise.inject.Instance<T> instance(T service) {
        return (jakarta.enterprise.inject.Instance<T>) java.lang.reflect.Proxy.newProxyInstance(
                OrgControlTowerMapResourceTest.class.getClassLoader(),
                new Class<?>[] {jakarta.enterprise.inject.Instance.class}, (proxy, method, args) -> {
                    return switch (method.getName()) {
                        case "isUnsatisfied" -> service == null;
                        case "isResolvable" -> service != null;
                        case "get" -> service;
                        default -> throw new UnsupportedOperationException(method.getName());
                    };
                });
    }

    private static final Instant NOW = Instant.parse("2026-10-26T12:00:00Z");
    private static final UUID DEPARTED = UUID.fromString("5c1f0a52-3a8e-4bb1-9c55-0d7d1e0e6a01");
    private static final UUID PLANNED = UUID.fromString("5c1f0a52-3a8e-4bb1-9c55-0d7d1e0e6a02");
    /** Trips-module trips by "trip/truck": their departure and end. */
    private final Map<String, Optional<Instant[]>> moduleTrips = Map.of(
            DEPARTED + "/AB12", Optional.of(new Instant[] {Instant.parse("2026-10-26T09:00:00Z"), null}),
            PLANNED + "/AB12", Optional.of(new Instant[] {null, null}));
    private final List<String> ranges = new ArrayList<>();

    private final InMemoryEngineCases engineCases = new InMemoryEngineCases();
    private final InMemoryTreatmentStore treatments = new InMemoryTreatmentStore();
    private final InMemoryContactStore contacts = new InMemoryContactStore();
    private final List<String> treatmentClients = new ArrayList<>();

    /** Symptom 7 and trip T1 on asset AB12 are client-a's. */
    private final TreatmentReads treatmentReads = new TreatmentReads() {
        @Override
        public Uni<Optional<JsonNode>> treatment(String clientId, long symptomId) {
            treatmentClients.add(clientId);
            JsonNode answer = JSON.createObjectNode().put("status", 200).set("data",
                    JSON.createObjectNode().set("trip_info", JSON.createObjectNode().put("trip_id", "T1")));
            return Uni.createFrom().item(symptomId == 7 ? Optional.of(answer) : Optional.empty());
        }

        @Override
        public Uni<Optional<JsonNode>> signals(String clientId, long symptomId) {
            treatmentClients.add(clientId);
            JsonNode answer = JSON.createObjectNode().put("status", 200).set("data",
                    JSON.createObjectNode().put("type", "FeatureCollection").set("features", JSON.createArrayNode()));
            return Uni.createFrom().item(symptomId == 7 ? Optional.of(answer) : Optional.empty());
        }

        @Override
        public Uni<Optional<JsonNode>> tripGeofences(String tripId, String clientId) {
            return Uni.createFrom().item("123".equals(tripId) && "client-a".equals(clientId)
                    ? Optional.of(JSON.createObjectNode().put("status", 200).set("data",
                            JSON.createArrayNode().add(JSON.createObjectNode().put("trip_id", tripId))))
                    : Optional.empty());
        }

        @Override
        public Uni<Optional<JsonNode>> tripPositions(String tripId, String assetId, String clientId, int limit) {
            treatmentClients.add(clientId);
            JsonNode positions = JSON.createArrayNode().add(JSON.createObjectNode().put("assetid", assetId));
            return Uni.createFrom().item("T1".equals(tripId) ? Optional.of(positions) : Optional.empty());
        }

        @Override
        public Uni<JsonNode> assetPositions(String assetId, Instant from, Instant to, String clientId, int limit,
                boolean onTrip) {
            ranges.add(assetId + " " + from + " " + to + (onTrip ? " on trip" : ""));
            return Uni.createFrom().item(JSON.createArrayNode().add(JSON.createObjectNode().put("assetid", assetId)));
        }
    };

    private final OrgControlTowerMapResource resource = resource(Optional.of("http://pgrest.test"));

    private static Response call(Uni<Response> uni) {
        return uni.await().atMost(WAIT);
    }

    @SuppressWarnings("unchecked")
    private static jakarta.enterprise.inject.Instance<com.microboxlabs.miot.core.trips.TripGeofences> geofences(
            com.microboxlabs.miot.core.trips.TripGeofences service) {
        return (jakarta.enterprise.inject.Instance<com.microboxlabs.miot.core.trips.TripGeofences>)
                java.lang.reflect.Proxy.newProxyInstance(OrgControlTowerMapResourceTest.class.getClassLoader(),
                        new Class<?>[] {jakarta.enterprise.inject.Instance.class}, (proxy, method, args) -> {
                            return switch (method.getName()) {
                                case "isUnsatisfied" -> service == null;
                                case "get" -> service;
                                default -> throw new UnsupportedOperationException(method.getName());
                            };
                        });
    }

    @Test
    void disabledTripsModuleHasNoGeofences() {
        Response answer = call(resource(Optional.empty()).tripGeofences(ORG, DEPARTED.toString()));
        assertEquals(200, answer.getStatus());
        assertEquals(0, ((JsonNode) answer.getEntity()).size());
    }

    @Test
    void moduleGeofencesAreReadAsTheActiveTenantAndNotFoundIs404() {
        var subject = resource(Optional.empty(), Set.of(ControlTowerAccessCatalog.VIEW), (tenant, trip) -> {
            assertEquals("client-a", tenant);
            assertEquals(DEPARTED, trip);
            throw new java.util.NoSuchElementException("trip not found");
        });
        assertEquals(404, call(subject.tripGeofences(ORG, DEPARTED.toString())).getStatus());
    }

    @Test
    void legacyGeofencesUseTheLegacyReader() {
        Response answer = call(resource(Optional.empty()).tripGeofences(ORG, "123"));
        assertEquals(200, answer.getStatus());
        assertEquals("123", ((JsonNode) answer.getEntity()).get(0).path("trip_id").asText());
    }

    @Test
    void tripsViewerReadsModuleGeofences() {
        var subject = resource(Optional.empty(), Set.of("trips:view"), (tenant, trip) -> JSON.createArrayNode()
                .add(JSON.createObjectNode().put("trip_id", trip.toString())));
        Response answer = call(subject.tripGeofences(ORG, DEPARTED.toString()));
        assertEquals(200, answer.getStatus());
        assertEquals(DEPARTED.toString(), ((JsonNode) answer.getEntity()).get(0).path("trip_id").asText());
    }

    @Test
    void tripsViewerCannotReadLegacyGeofences() {
        var subject = resource(Optional.empty(), Set.of("trips:view"));
        assertEquals(403, call(subject.tripGeofences(ORG, "123")).getStatus());
    }

    @Test
    void readsAsTheOrganizationsApplication() {
        Response counts = call(resource.conditions(ORG, null, null));
        assertEquals(200, counts.getStatus());
        assertEquals(3, ((JsonNode) counts.getEntity()).get("Stable").asInt());
        assertEquals(200, call(resource.positions(ORG)).getStatus());
        assertEquals(200, call(resource.summary(ORG)).getStatus());
        assertEquals(List.of("client-a", "client-a", "client-a"), tokensAskedFor);
    }

    private static EngineCase openCase(long id, int level) {
        return new EngineCase(id, UUID.randomUUID(), "0.1.0", "Botón de pánico", "emergencies", "DEMO0" + id,
                Instant.now(), level, null, null, null, null, null, 0, 2, null);
    }

    @Test
    void theActiveCountsIncludeTheOpenCases() {
        response = new GpsRpcApi.RpcResponse(200, "ok", JSON.createObjectNode().put("Code Black", 1).put("Stable", 3));
        engineCases.add(openCase(3, 4));
        engineCases.add(openCase(4, 4));

        JsonNode counts = (JsonNode) call(resource.conditions(ORG, null, null)).getEntity();

        assertEquals(3, counts.get("Code Black").asInt());
        assertEquals(3, counts.get("Stable").asInt());
    }

    @Test
    void theCountsOfARangeAreTheGpsDatabasesOnly() {
        engineCases.add(openCase(3, 4));

        JsonNode counts = (JsonNode) call(resource.conditions(ORG, "2026-10-01", "2026-10-02")).getEntity();

        assertFalse(counts.has("Code Black"));
    }

    @Test
    void theOpenCasesCountWhenTheGpsDatabaseIsDown() {
        response = new GpsRpcApi.RpcResponse(500, "Unexpected error", null);
        assertEquals(503, call(resource.conditions(ORG, null, null)).getStatus(), "nothing to count");

        engineCases.add(openCase(3, 4));
        Response counts = call(resource(Optional.empty()).conditions(ORG, null, null));

        assertEquals(200, counts.getStatus());
        assertEquals(1, ((JsonNode) counts.getEntity()).get("Code Black").asInt());
    }

    @Test
    void aBadRangeIs400() {
        assertEquals(400, call(resource.conditions(ORG, "2026-10-01", null)).getStatus());
    }

    @Test
    void unavailableGpsDataIs503() {
        Response notConfigured = call(resource(Optional.empty()).positions(ORG));
        assertEquals(503, notConfigured.getStatus());
        assertEquals(Map.of("error", "GPS data is not configured"), notConfigured.getEntity());

        response = new GpsRpcApi.RpcResponse(500, "Unexpected error", null);
        assertEquals(503, call(resource.summary(ORG)).getStatus());
    }

    @Test
    void anotherOrganizationInThePathIsRefused() {
        WebApplicationException e = assertThrows(WebApplicationException.class, () -> resource.positions("org-b"));
        assertEquals(403, e.getResponse().getStatus());
        assertEquals(List.of(), tokensAskedFor);
    }

    private static jakarta.ws.rs.core.UriInfo query(String query) {
        var uri = org.jboss.resteasy.reactive.common.jaxrs.UriBuilderImpl.fromUri("http://x/s?" + query).build();
        return new jakarta.ws.rs.core.UriInfo() {
            @Override
            public String getPath() {
                return "/s";
            }

            @Override
            public String getPath(boolean decode) {
                return "/s";
            }

            @Override
            public List<jakarta.ws.rs.core.PathSegment> getPathSegments() {
                return List.of();
            }

            @Override
            public List<jakarta.ws.rs.core.PathSegment> getPathSegments(boolean decode) {
                return List.of();
            }

            @Override
            public java.net.URI getRequestUri() {
                return uri;
            }

            @Override
            public jakarta.ws.rs.core.UriBuilder getRequestUriBuilder() {
                return null;
            }

            @Override
            public java.net.URI getAbsolutePath() {
                return uri;
            }

            @Override
            public jakarta.ws.rs.core.UriBuilder getAbsolutePathBuilder() {
                return null;
            }

            @Override
            public java.net.URI getBaseUri() {
                return uri;
            }

            @Override
            public jakarta.ws.rs.core.UriBuilder getBaseUriBuilder() {
                return null;
            }

            @Override
            public jakarta.ws.rs.core.MultivaluedMap<String, String> getPathParameters() {
                return new jakarta.ws.rs.core.MultivaluedHashMap<>();
            }

            @Override
            public jakarta.ws.rs.core.MultivaluedMap<String, String> getPathParameters(boolean decode) {
                return new jakarta.ws.rs.core.MultivaluedHashMap<>();
            }

            @Override
            public jakarta.ws.rs.core.MultivaluedMap<String, String> getQueryParameters() {
                var params = new jakarta.ws.rs.core.MultivaluedHashMap<String, String>();
                for (String pair : query.split("&")) {
                    String[] kv = pair.split("=", 2);
                    params.add(kv[0], kv.length > 1 ? kv[1] : "");
                }
                return params;
            }

            @Override
            public jakarta.ws.rs.core.MultivaluedMap<String, String> getQueryParameters(boolean decode) {
                return getQueryParameters();
            }

            @Override
            public List<String> getMatchedURIs() {
                return List.of();
            }

            @Override
            public List<String> getMatchedURIs(boolean decode) {
                return List.of();
            }

            @Override
            public List<Object> getMatchedResources() {
                return List.of();
            }

            @Override
            public java.net.URI resolve(java.net.URI u) {
                return u;
            }

            @Override
            public java.net.URI relativize(java.net.URI u) {
                return u;
            }
        };
    }

    @Test
    void symptomsPassTheAllowedFiltersAndKeepTheTotals() {
        Response page = call(resource.symptoms(ORG, query("p_icu_code=3&p_page=1&p_asset_id=AB12")));
        assertEquals(200, page.getStatus());
        assertEquals(1, ((JsonNode) page.getEntity()).get("total_rows").asInt());
        assertEquals(Map.of("p_icu_code", "3", "p_page", "1", "p_asset_id", "AB12"), sentFilters.get(0));
        assertEquals(List.of("client-a"), tokensAskedFor);
    }

    @Test
    void anUnknownOrMalformedSymptomFilterIs400() {
        assertEquals(400, call(resource.symptoms(ORG, query("p_client_id=other"))).getStatus());
        assertEquals(400, call(resource.symptoms(ORG, query("p_page=one"))).getStatus());
        assertEquals(400, call(resource.symptoms(ORG, query("anything="))).getStatus());
        assertEquals(List.of(), sentFilters);
    }

    @Test
    void theTreatmentPageReadsAsTheClientIdTheSymptomListUses() {
        Response header = call(resource.symptom(ORG, "7"));
        assertEquals(200, header.getStatus());
        assertEquals("T1", ((JsonNode) header.getEntity()).path("trip_info").path("trip_id").asText());
        Response signals = call(resource.symptomSignals(ORG, "7"));
        assertEquals("FeatureCollection", ((JsonNode) signals.getEntity()).path("type").asText());
        Response positions = call(resource.tripPositions(ORG, "T1", "AB12"));
        assertEquals("AB12", ((JsonNode) positions.getEntity()).get(0).path("assetid").asText());
        assertEquals(List.of("client-a", "client-a", "client-a"), treatmentClients);
    }

    @Test
    void anotherOrganizationsSymptomOrTripIs404() {
        assertEquals(404, call(resource.symptom(ORG, "8")).getStatus());
        assertEquals(404, call(resource.symptomSignals(ORG, "8")).getStatus());
        assertEquals(404, call(resource.tripPositions(ORG, "T9", "AB12")).getStatus());
    }

    @Test
    void aBadSymptomIdOrAMissingAssetIs400() {
        assertEquals(400, call(resource.symptom(ORG, "abc")).getStatus());
        assertEquals(400, call(resource.tripPositions(ORG, "T1", null)).getStatus());
    }

    @Test
    void aTripsModuleTripReadsItsTrucksPositionsFromItsDepartureUntilNowWithTheTripAsEvidence() {
        Response positions = call(resource.tripPositions(ORG, DEPARTED.toString(), "AB12"));

        assertEquals(200, positions.getStatus());
        assertEquals("AB12", ((JsonNode) positions.getEntity()).get(0).path("assetid").asText());
        assertEquals(List.of("AB12 2026-10-26T09:00:00Z 2026-10-26T12:00:00Z on trip"), ranges);
        assertEquals(List.of(), treatmentClients);
    }

    @Test
    void aTripsModuleTripBeforeItsDepartureHasNoPositions() {
        Response positions = call(resource.tripPositions(ORG, PLANNED.toString(), "AB12"));

        assertEquals(200, positions.getStatus());
        assertEquals(0, ((JsonNode) positions.getEntity()).size());
        assertEquals(List.of(), ranges);
    }

    @Test
    void aTripsModuleTripOnAnotherTruckOrOfAnotherOrganizationIs404() {
        assertEquals(404, call(resource.tripPositions(ORG, DEPARTED.toString(), "ZZ99")).getStatus());
        assertEquals(404, call(resource.tripPositions(ORG, UUID.randomUUID().toString(), "AB12")).getStatus());
        assertEquals(400, call(resource.tripPositions(ORG, DEPARTED.toString(), null)).getStatus());
    }

    @Test
    void aCaseWithoutATripReadsItsVehiclesPositions() {
        engineCases.add(openCase(3, 4));

        Response positions = call(resource.symptomPositions(ORG, "-3"));

        assertEquals(200, positions.getStatus());
        assertEquals("DEMO03", ((JsonNode) positions.getEntity()).get(0).path("assetid").asText());
        assertEquals(404, call(resource.symptomPositions(ORG, "-9")).getStatus());
        assertEquals(400, call(resource.symptomPositions(ORG, "7")).getStatus());
    }

    @Test
    void anAssetsPositionsAreReadForARange() {
        Response positions = call(resource.assetPositions(ORG, "AB12", "2026-10-22T00:00:00-03:00",
                "2026-10-23T23:59:59-03:00"));

        assertEquals(200, positions.getStatus());
        assertEquals("AB12", ((JsonNode) positions.getEntity()).get(0).path("assetid").asText());
        assertEquals(400, call(resource.assetPositions(ORG, "AB12", "2026-10-23T00:00:00Z",
                "2026-10-22T00:00:00Z")).getStatus());
        assertEquals(400, call(resource.assetPositions(ORG, "AB12", "2026-10-01T00:00:00Z",
                "2026-10-22T00:00:00Z")).getStatus());
        assertEquals(400, call(resource.assetPositions(ORG, "AB12", null, null)).getStatus());
    }

    @Test
    void theTreatmentPageInAnotherOrganizationIsRefused() {
        WebApplicationException e = assertThrows(WebApplicationException.class, () -> resource.symptom("org-b", "7"));
        assertEquals(403, e.getResponse().getStatus());
        assertEquals(List.of(), treatmentClients);
    }

    private OrgControlTowerMapResource engineOnly() {
        return resource(Optional.of("http://pgrest.test"), Set.of(ControlTowerAccessCatalog.VIEW), null, sampleSignals, false);
    }

    private static EngineCase openCase(long id, String asset, String name, int level) {
        return new EngineCase(id, UUID.randomUUID(), "0.1.0", name, "emergencies", asset,
                Instant.now().minusSeconds(id), level, null, null, null, null, null, 0, 2, null);
    }

    @Test
    void engineOnlyTheListIsTheCasesPagedWithoutTheGpsDatabase() {
        for (long id = 1; id <= 12; id++) {
            engineCases.add(openCase(id, "AB" + id, id % 2 == 0 ? "Botón de pánico" : "Pérdida de señal", 3));
        }
        var subject = engineOnly();

        JsonNode first = (JsonNode) call(subject.symptoms(ORG, query("p_page=1&p_page_size=5"))).getEntity();
        JsonNode third = (JsonNode) call(subject.symptoms(ORG, query("p_page=3&p_page_size=5"))).getEntity();

        assertEquals(5, first.get("data").size());
        assertEquals(-1, first.get("data").get(0).get("id").asLong());
        assertEquals(12, first.get("total_rows").asInt());
        assertEquals(3, first.get("total_pages").asInt());
        assertEquals(1, first.get("page").asInt());
        assertEquals(5, first.get("page_size").asInt());
        assertEquals(2, first.get("symptom_name_list").size());
        assertEquals(2, third.get("data").size());
        assertEquals(List.of(), gpsCalls);
        assertEquals(List.of(), tokensAskedFor);
    }

    @Test
    void engineOnlyTheListFiltersTheCases() {
        engineCases.add(openCase(1, "AB12", "Pérdida de señal", 3));
        engineCases.add(openCase(2, "CD34", "Pérdida de señal", 1));
        var subject = engineOnly();

        JsonNode byLevel = (JsonNode) call(subject.symptoms(ORG, query("p_icu_code=3"))).getEntity();

        assertEquals(1, byLevel.get("total_rows").asInt());
        assertEquals("AB12", byLevel.get("data").get(0).get("asset_id").asText());
        assertEquals(400, call(subject.symptoms(ORG, query("p_client_id=other"))).getStatus());
        assertEquals(400, call(subject.symptoms(ORG, query("p_page=one"))).getStatus());
        assertEquals(List.of(), gpsCalls);
    }

    private static EngineCase onTrip(long id, String trip, EngineCase.TripDetails details) {
        return new EngineCase(id, UUID.randomUUID(), "0.1.0", "Pérdida de señal", "connectivity", "AB" + id,
                Instant.now().minusSeconds(id), 2, trip, null, null, null, null, 0, null, 0L, null).withTrip(details);
    }

    /** Case 1 on trip A (two drivers, carrier 76.111.111-1), case 2 on trip B, case 3 without a trip. */
    private void casesOnTrips() {
        engineCases.trips.put("A", new com.microboxlabs.miot.symptoms.cases.InMemoryEngineCases.Trip("12.345.678-9",
                "9.876.543-K", "c-1", "76.111.111-1", "Planta Norte", "Puerto Sur"));
        engineCases.trips.put("B", new com.microboxlabs.miot.symptoms.cases.InMemoryEngineCases.Trip("11.111.111-1",
                null, "c-2", "77.222.222-2", "Planta Sur", "Puerto Norte"));
        engineCases.add(onTrip(1, "A", new EngineCase.TripDetails("Driver A", "Carrier A", "Planta Norte",
                "Puerto Sur")));
        engineCases.add(onTrip(2, "B", new EngineCase.TripDetails("Driver B", "Carrier B", "Planta Sur",
                "Puerto Norte")));
        engineCases.add(onTrip(3, null, null));
    }

    private List<String> assets(OrgControlTowerMapResource subject, String q) {
        List<String> out = new ArrayList<>();
        ((JsonNode) call(subject.symptoms(ORG, query(q))).getEntity()).get("data")
                .forEach(r -> out.add(r.get("asset_id").asText()));
        return out;
    }

    @Test
    void engineOnlyTheTripFiltersMatchTheCasesLiveTrip() {
        casesOnTrips();
        var subject = engineOnly();

        assertEquals(List.of("AB1"), assets(subject, "p_driver_id=12345678-9"), "first driver, other format");
        assertEquals(List.of("AB1"), assets(subject, "p_driver_id=9876543k"), "second driver");
        assertEquals(List.of("AB2"), assets(subject, "p_carrier_id=77222222-2"));
        assertEquals(List.of("AB2"), assets(subject, "p_carrier_id=c-2"), "the carrier's id");
        assertEquals(List.of("AB1"), assets(subject, "p_origin=planta norte"));
        assertEquals(List.of("AB2"), assets(subject, "p_destination=Puerto Norte&p_origin=Planta Sur"));
        assertEquals(List.of(), assets(subject, "p_origin=Planta"), "the whole name");
        assertEquals(List.of(), assets(subject, "p_driver_id=12345678-9&p_carrier_id=77222222-2"));
        assertEquals(List.of(), gpsCalls);
    }

    @Test
    void engineOnlyACarrierSeesTheCasesOfItsOwnTrips() {
        casesOnTrips();

        JsonNode page = (JsonNode) call(engineOnly().symptoms(ORG, query("p_carrier_id=76.111.111-1"))).getEntity();

        assertEquals(1, page.get("total_rows").asInt());
        JsonNode row = page.get("data").get(0);
        assertEquals(-1, row.get("id").asLong());
        assertEquals("Driver A", row.get("driver").asText());
        assertEquals("Carrier A", row.get("carrier").asText());
        assertEquals("Planta Norte", row.get("origin").asText());
        assertEquals("Puerto Sur", row.get("destination").asText());
        assertEquals(List.of(), assets(engineOnly(), "p_carrier_id=78.333.333-3"), "a carrier without trips");
    }

    @Test
    void engineOnlyACaseWithoutALiveTripHasNoTripNames() {
        casesOnTrips();

        JsonNode rows = ((JsonNode) call(engineOnly().symptoms(ORG, query("p_page_size=10"))).getEntity()).get("data");

        assertEquals(3, rows.size());
        assertTrue(rows.get(2).get("driver").isNull());
        assertTrue(rows.get(2).get("carrier").isNull());
    }

    @Test
    void engineOnlyTheCountsAreTheOpenCasesOnly() {
        engineCases.add(openCase(1, "AB12", "Pérdida de señal", 4));
        engineCases.add(openCase(2, "CD34", "Pérdida de señal", 2));
        var subject = engineOnly();

        JsonNode counts = (JsonNode) call(subject.conditions(ORG, null, null)).getEntity();
        JsonNode range = (JsonNode) call(subject.conditions(ORG, "2026-01-01", "2099-01-01")).getEntity();

        assertEquals(1, counts.get("Code Black").asInt());
        assertEquals(1, counts.get("Compromised condition").asInt());
        assertFalse(counts.has("Stable"));
        assertEquals(1, range.get("Code Black").asInt());
        assertEquals(400, call(subject.conditions(ORG, "2026-10-01", null)).getStatus());
        assertEquals(List.of(), gpsCalls);
    }

    @Test
    void engineOnlyThePositionsCarryTheHighestOpenCaseLevel() {
        response = new GpsRpcApi.RpcResponse(200, "ok", JSON.createArrayNode()
                .add(JSON.createObjectNode().put("assetid", "AB12").put("symptoms_condition", 1)
                        .put("latitude", -33.0).put("longitude", -70.0)
                        .put("speed_limit_condition", 4).put("speed_limit", 90).put("lost_signal", true)
                        .set("associate_symptoms", JSON.createArrayNode().add(JSON.createObjectNode()
                                .put("symptom_name", "legacy").put("icu_condition", 1))))
                .add(JSON.createObjectNode().put("assetid", "CD34").put("symptoms_condition", 3)));
        engineCases.add(openCase(1, "AB12", "Pérdida de señal", 2));
        engineCases.add(openCase(2, "AB12", "Botón de pánico", 4));

        JsonNode positions = (JsonNode) call(engineOnly().positions(ORG)).getEntity();

        JsonNode withCases = positions.get(0);
        assertEquals("offline", withCases.path("signal").path("state").asText());
        assertEquals("2026-10-26T11:40:00Z", withCases.path("signal").path("offline_since").asText());
        assertEquals(-33.0, withCases.path("latitude").asDouble());
        assertEquals(-70.0, withCases.path("longitude").asDouble());
        assertEquals(4, withCases.get("symptoms_condition").asInt());
        assertEquals(2, withCases.get("associate_symptoms").size());
        assertEquals("Pérdida de señal", withCases.get("associate_symptoms").get(0).get("symptom_name").asText());
        assertTrue(withCases.get("speed_limit_condition").isNull());
        assertFalse(withCases.has("speed_limit"));
        assertFalse(withCases.has("lost_signal"));
        assertEquals(0, positions.get(1).get("symptoms_condition").asInt(), "no open case");
        assertEquals(0, positions.get(1).get("associate_symptoms").size());
        assertEquals("online", positions.get(1).path("signal").path("state").asText());
        assertEquals(List.of("positions"), gpsCalls, "the positions still come from the GPS database");
    }

    @Test
    void engineOnlyTheSummaryCountsTheOpenCasesAndZerosTheRest() {
        engineCases.add(openCase(1, "AB12", "Pérdida de señal", 3));
        engineCases.add(openCase(2, "CD34", "Pérdida de señal", 3));

        JsonNode summary = (JsonNode) call(engineOnly().summary(ORG)).getEntity();

        JsonNode sections = summary.get("sections");
        assertEquals(List.of("services", "fleet", "symptoms"), List.of(sections.get(0).get("title").asText(),
                sections.get(1).get("title").asText(), sections.get(2).get("title").asText()));
        sections.get(0).get("items").forEach(item -> assertEquals(0, item.get("value").asInt()));
        JsonNode symptoms = sections.get(2).get("items");
        assertEquals("critical_condition", symptoms.get(3).get("key").asText());
        assertEquals(2, symptoms.get(3).get("value").asInt());
        assertEquals(List.of(), gpsCalls);
    }

    @Test
    void engineOnlyAGpsDatabaseSymptomIs404AndACaseStillAnswers() {
        engineCases.add(openCase(3, "DEMO03", "Botón de pánico", 4));
        var subject = engineOnly();

        assertEquals(404, call(subject.symptom(ORG, "7")).getStatus());
        assertEquals(404, call(subject.symptomSignals(ORG, "7")).getStatus());
        assertEquals(404, call(subject.symptomPositions(ORG, "7")).getStatus());
        assertEquals(List.of(), treatmentClients);
        assertEquals(200, call(subject.symptom(ORG, "-3")).getStatus());
        assertEquals(200, call(subject.symptomSignals(ORG, "-3")).getStatus());
        assertEquals(200, call(subject.symptomPositions(ORG, "-3")).getStatus());
    }

    /** AB12 is offline since 11:40, CD34 online, EF56 never seen. */
    private final SignalStates sampleSignals = (ids, now) -> {
        Map<String, SignalState> out = new java.util.LinkedHashMap<>();
        for (String id : ids) {
            out.put(id, switch (id) {
                case "AB12" -> new SignalState(Status.OFFLINE, Instant.parse("2026-10-26T11:40:00Z"),
                        Instant.parse("2026-10-26T11:40:00Z"), 1190L, 300L);
                case "CD34" -> new SignalState(Status.ONLINE, null, now.minusSeconds(30), 25L, 180L);
                default -> SignalState.UNKNOWN;
            });
        }
        return out;
    };

    private void positionsOf(String... assets) {
        com.fasterxml.jackson.databind.node.ArrayNode data = JSON.createArrayNode();
        for (String a : assets) {
            data.addObject().put("assetid", a).put("speed", 0);
        }
        response = new GpsRpcApi.RpcResponse(200, "ok", data);
    }

    @Test
    void eachPositionCarriesItsAssetsSignalState() {
        positionsOf("AB12", "CD34", "EF56");
        JsonNode body = (JsonNode) call(resource(Optional.of("http://pgrest.test"),
                Set.of(ControlTowerAccessCatalog.VIEW), null, sampleSignals).positions(ORG)).getEntity();

        JsonNode offline = body.get(0).path("signal");
        assertEquals("offline", offline.path("state").asText());
        assertEquals("2026-10-26T11:40:00Z", offline.path("offline_since").asText());
        assertEquals(1190, offline.path("silence_s").asLong());
        assertEquals(300, offline.path("expected_s").asLong());
        assertEquals("online", body.get(1).path("signal").path("state").asText());
        assertFalse(body.get(1).path("signal").has("offline_since"));
        assertEquals("unknown", body.get(2).path("signal").path("state").asText());
        assertEquals(1, body.get(2).path("signal").size(), "unknown has only its state");
    }

    @Test
    void withoutTheDetectorEveryPositionIsUnknown() {
        positionsOf("AB12");
        JsonNode body = (JsonNode) call(resource.positions(ORG)).getEntity();
        assertEquals("unknown", body.get(0).path("signal").path("state").asText());
    }

    @Test
    void aFailedDetectorReadLeavesPositionsVisibleAndSignalUnknown() {
        positionsOf("V1");
        SignalStates unavailable = (ids, now) -> {
            throw new IllegalStateException("Store unavailable");
        };
        OrgControlTowerMapResource subject = resource(Optional.of("http://pgrest.test"),
                Set.of(ControlTowerAccessCatalog.VIEW), null, unavailable);
        Response positions = call(subject.positions(ORG));
        assertEquals(200, positions.getStatus());
        JsonNode body = (JsonNode) positions.getEntity();
        assertEquals("V1", body.get(0).path("assetid").asText());
        assertEquals("unknown", body.get(0).path("signal").path("state").asText());
        Response signal = call(subject.assetSignal(ORG, "V1"));
        assertEquals(200, signal.getStatus());
        assertEquals("unknown", ((JsonNode) signal.getEntity()).path("state").asText());
        assertEquals(404, call(subject.assetSignal(ORG, "OTHER")).getStatus());
    }

    @Test
    void theCachedPositionsAreNotChangedBySignalStates() {
        positionsOf("AB12");
        OrgControlTowerMapResource withSignals = resource(Optional.of("http://pgrest.test"),
                Set.of(ControlTowerAccessCatalog.VIEW), null, sampleSignals);
        call(withSignals.positions(ORG));
        assertFalse(response.data().get(0).has("signal"));
    }

    @Test
    void oneAssetsSignalIsReadOnlyForTheOrganizationsAssets() {
        positionsOf("AB12", "CD34");
        OrgControlTowerMapResource withSignals = resource(Optional.of("http://pgrest.test"),
                Set.of(ControlTowerAccessCatalog.VIEW), null, sampleSignals);

        Response found = call(withSignals.assetSignal(ORG, "AB12"));
        assertEquals(200, found.getStatus());
        assertEquals("offline", ((JsonNode) found.getEntity()).path("state").asText());
        assertEquals(404, call(withSignals.assetSignal(ORG, "ZZ99")).getStatus());
        assertThrows(WebApplicationException.class, () -> withSignals.assetSignal("org-b", "AB12"));
    }

    /** The GPS database's live positions name the asset {@code asset_id}, as production returns them. */
    @Test
    void positionsNamingTheAssetAssetIdCarryTheirSignalAndAnswerOneAsset() {
        response = new GpsRpcApi.RpcResponse(200, "ok", JSON.createArrayNode()
                .add(JSON.createObjectNode().put("asset_id", "AB12").put("speed", 0))
                .add(JSON.createObjectNode().put("asset_id", "CD34").put("speed", 0)));
        OrgControlTowerMapResource withSignals = resource(Optional.of("http://pgrest.test"),
                Set.of(ControlTowerAccessCatalog.VIEW), null, sampleSignals);

        JsonNode body = (JsonNode) call(withSignals.positions(ORG)).getEntity();
        assertEquals("offline", body.get(0).path("signal").path("state").asText());
        assertEquals("online", body.get(1).path("signal").path("state").asText());
        Response one = call(withSignals.assetSignal(ORG, "AB12"));
        assertEquals(200, one.getStatus());
        assertEquals("offline", ((JsonNode) one.getEntity()).path("state").asText());
    }
}

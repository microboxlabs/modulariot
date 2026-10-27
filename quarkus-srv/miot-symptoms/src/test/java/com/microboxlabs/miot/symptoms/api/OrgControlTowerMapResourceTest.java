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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.ServiceAccountTokenIssuer.IssuedToken;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
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
            return Uni.createFrom().item(response);
        }

        @Override
        public Uni<RpcResponse> summary(String authorization) {
            return Uni.createFrom().item(response);
        }

        @Override
        public Uni<RpcResponse> conditions(String authorization, String from, String to) {
            return Uni.createFrom().item(response);
        }

        @Override
        public Uni<JsonNode> symptoms(String authorization, Map<String, String> filters) {
            sentFilters.add(filters);
            JsonNode page = JSON.createObjectNode().put("total_rows", 1).set("data",
                    JSON.createArrayNode().add(JSON.createObjectNode().put("asset_id", "AB12")));
            return Uni.createFrom().item(page);
        }
    };

    private final List<Map<String, String>> sentFilters = new ArrayList<>();

    private static final class Roles extends OrganizationRoleService {
        Roles() {
            super(null, null, null);
        }
    }

    private OrgControlTowerMapResource resource(Optional<String> url) {
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
        return new OrgControlTowerMapResource(tenant, org, new Roles(), null, map,
                new ControlTowerTreatmentService(treatmentReads), new EngineCaseService(engineCases,
                        (t, a, d) -> { }, t -> null, java.time.Clock.systemUTC()),
                new TreatmentService(treatments, contacts, new DemoSeeder(false, contacts, treatments),
                        new AuditService(new InMemoryAuditStore())),
                new TripWindows((tenantCode, trip, asset) -> moduleTrips.getOrDefault(trip + "/" + asset,
                        Optional.empty()), java.time.Clock.fixed(NOW, java.time.ZoneOffset.UTC)));
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
        public Uni<Optional<JsonNode>> tripPositions(String tripId, String assetId, String clientId, int limit) {
            treatmentClients.add(clientId);
            JsonNode positions = JSON.createArrayNode().add(JSON.createObjectNode().put("assetid", assetId));
            return Uni.createFrom().item("T1".equals(tripId) ? Optional.of(positions) : Optional.empty());
        }

        @Override
        public Uni<JsonNode> assetPositions(String assetId, Instant from, Instant to, String clientId, int limit) {
            ranges.add(assetId + " " + from + " " + to);
            return Uni.createFrom().item(JSON.createArrayNode().add(JSON.createObjectNode().put("assetid", assetId)));
        }
    };

    private final OrgControlTowerMapResource resource = resource(Optional.of("http://pgrest.test"));

    private static Response call(Uni<Response> uni) {
        return uni.await().atMost(WAIT);
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
    void aTripsModuleTripReadsItsTrucksPositionsFromItsDepartureUntilNow() {
        Response positions = call(resource.tripPositions(ORG, DEPARTED.toString(), "AB12"));

        assertEquals(200, positions.getStatus());
        assertEquals("AB12", ((JsonNode) positions.getEntity()).get(0).path("assetid").asText());
        assertEquals(List.of("AB12 2026-10-26T09:00:00Z 2026-10-26T12:00:00Z"), ranges);
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
}

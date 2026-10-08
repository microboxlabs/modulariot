package com.microboxlabs.miot.symptoms.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.ServiceAccountTokenIssuer.IssuedToken;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.map.ControlTowerMapService;
import com.microboxlabs.miot.symptoms.map.GpsRpcApi;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
        return new OrgControlTowerMapResource(tenant, org, new Roles(), null, map);
    }

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
        assertEquals(List.of(), sentFilters);
    }
}

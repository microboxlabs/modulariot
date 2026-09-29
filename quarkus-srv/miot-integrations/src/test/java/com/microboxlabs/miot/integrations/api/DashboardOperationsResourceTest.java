package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.integrations.service.DashboardOperationService;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class DashboardOperationsResourceTest {
    private static final String KEY = "0123456789abcdef0123456789abcdef";
    private static final DashboardOperationService.Request REQUEST = new DashboardOperationService.Request(
            "acme", "ops", "summary", "viewer", "connection", "operation", Map.of(),
            new DashboardOperationService.Limits(100, 10000));

    @Test
    void failsClosedBeforeTenantLookupForAbsentWeakOrWrongKeys() {
        for (String configured : new String[]{"", "short", " ".repeat(32)}) {
            Resource resource = new Resource(configured);
            assertResponse(503, resource.execute(KEY, REQUEST));
            assertEquals(0, resource.lookups);
        }
        for (String presented : new String[]{null, "", KEY + "x", "f".repeat(32)}) {
            Resource resource = new Resource(KEY);
            assertResponse(401, resource.execute(presented, REQUEST));
            assertEquals(0, resource.lookups);
        }
    }

    @Test
    void validatesAuthenticatedRequestsAndRefusesUnknownOrganizations() {
        Resource resource = new Resource(KEY);
        assertResponse(400, resource.execute(KEY, null));
        assertEquals(0, resource.lookups);
        resource.tenant = Optional.empty();
        assertResponse(404, resource.execute(KEY, REQUEST));
        assertEquals(0, resource.service.calls);
    }

    @Test
    void resolvesOrganizationSlugBeforeExecutingOnWorkerAndNeverCaches() {
        Resource resource = new Resource(KEY);
        Response response = assertResponse(200, resource.execute(KEY, REQUEST));
        assertEquals("acme", resource.slug);
        assertEquals("ACME", resource.service.tenant);
        assertEquals(REQUEST, resource.service.request);
        assertNotNull(response.getEntity());
    }

    @Test
    void redactsProviderAndTenantLookupFailures() {
        Resource resource = new Resource(KEY);
        resource.service.fail = true;
        Response response = assertResponse(502, resource.execute(KEY, REQUEST));
        assertEquals(Map.of("error", "Dashboard operation could not be completed"), response.getEntity());
        resource.lookupFailure = true;
        response = assertResponse(502, resource.execute(KEY, REQUEST));
        assertEquals(Map.of("error", "Dashboard operation could not be completed"), response.getEntity());
    }

    private static Response assertResponse(int status, Uni<Response> pending) {
        Response response = pending.await().atMost(Duration.ofSeconds(2));
        assertEquals(status, response.getStatus());
        assertEquals("no-store", response.getHeaderString("Cache-Control"));
        return response;
    }

    private static class Resource extends DashboardOperationsResource {
        final Service service;
        Optional<String> tenant = Optional.of("ACME");
        String slug;
        int lookups;
        boolean lookupFailure;
        Resource(String key) { this(new Service(), key); }
        Resource(Service service, String key) {
            super(service, Optional.of(key));
            this.service = service;
        }
        @Override Uni<Optional<String>> tenantCodeFor(String slug) {
            lookups++;
            this.slug = slug;
            return lookupFailure ? Uni.createFrom().failure(new IllegalStateException("private database details"))
                    : Uni.createFrom().item(tenant);
        }
    }

    private static class Service extends DashboardOperationService {
        String tenant;
        Request request;
        int calls;
        boolean fail;
        Service() { super(null, null, null, null); }
        @Override public ObjectNode execute(String tenant, Request request) {
            calls++;
            if (fail) throw new IllegalStateException("private provider details");
            this.tenant = tenant;
            this.request = request;
            ObjectNode result = new ObjectMapper().createObjectNode();
            result.putArray("rows");
            return result;
        }
    }
}

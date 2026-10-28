package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import com.microboxlabs.miot.integrations.service.DashboardAuthoringService;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class DashboardAuthoringResourceTest {
    private static final String KEY = "demo".repeat(8);
    private static final DashboardAuthoringResource.SourceRequest REQUEST = new DashboardAuthoringResource.SourceRequest("demo-org", "demo-author", null);
    static class Service extends DashboardAuthoringService {
        RuntimeException failure;
        String tenant;
        Service() { super(null, null, null, null, 1_000_000_000L); }
        @Override public List<Source> sources(String tenantCode) {
            tenant = tenantCode;
            if (failure != null) throw failure;
            return List.of(new Source("demo-source", "Demo source", "BIGQUERY", "demo-project"));
        }
    }
    static class Resource extends DashboardAuthoringResource {
        int lookups;
        boolean missing;
        final Service provider;
        Resource(String key) { this(key, new Service()); }
        Resource(String key, Service provider) { super(provider, Optional.of(key)); this.provider = provider; }
        @Override protected Uni<Optional<String>> tenantCodeFor(String slug) {
            lookups++;
            assertEquals("demo-org", slug);
            return Uni.createFrom().item(missing ? Optional.empty() : Optional.of("demo-tenant"));
        }
    }
    private static Response answer(int status, Uni<Response> response) {
        var actual = response.await().atMost(Duration.ofSeconds(2));
        assertEquals(status, actual.getStatus());
        assertEquals("no-store", actual.getHeaderString("Cache-Control"));
        return actual;
    }
    @Test void keysFailClosedBeforeTenantLookup() {
        for (String key : List.of("", "weak", " ".repeat(32))) {
            var resource = new Resource(key);
            answer(503, resource.sources(KEY, REQUEST));
            assertEquals(0, resource.lookups);
        }
        var resource = new Resource(KEY);
        answer(401, resource.sources("wrong", REQUEST));
        answer(401, resource.sources(null, REQUEST));
        assertEquals(0, resource.lookups);
    }
    @Test void validatesRequestsAndResolvesOrganizationBeforeCallingProvider() {
        var resource = new Resource(KEY);
        answer(400, resource.sources(KEY, null));
        assertEquals(0, resource.lookups);
        answer(200, resource.sources(KEY, REQUEST));
        assertEquals("demo-tenant", resource.provider.tenant);
        resource.missing = true;
        answer(404, resource.sources(KEY, REQUEST));
    }
    @Test void mapsKnownRefusalsAndRedactsUnexpectedProviderErrors() {
        var resource = new Resource(KEY);
        resource.provider.failure = new IllegalArgumentException("Invalid query");
        answer(400, resource.sources(KEY, REQUEST));
        resource.provider.failure = new DashboardAuthoringService.ConflictException("The query was saved by someone else");
        answer(409, resource.sources(KEY, REQUEST));
        resource.provider.failure = new IllegalStateException("demo private provider detail");
        assertEquals(Map.of("error", "Dashboard authoring could not be completed"), answer(502, resource.sources(KEY, REQUEST)).getEntity());
    }
}

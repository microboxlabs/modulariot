package com.microboxlabs.miot.fleet.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.fleet.directory.AssetFacts;
import com.microboxlabs.miot.fleet.directory.DemoFleetData;
import com.microboxlabs.miot.fleet.directory.FleetData;
import com.microboxlabs.miot.fleet.directory.FleetDirectoryService;
import com.microboxlabs.miot.fleet.directory.FleetUnavailableException;
import com.microboxlabs.miot.fleet.directory.InMemoryActivityStore;
import com.microboxlabs.miot.fleet.directory.InMemoryProfileStore;
import com.microboxlabs.miot.fleet.directory.Views;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** The path organization must be the resolved one; errors map to 400, 404 and 503. */
class OrgFleetResourceTest {

    private static final String ORG = "acme";
    private static final Duration WAIT = Duration.ofSeconds(5);
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-14T15:00:00Z"), ZoneOffset.UTC);

    private final List<Set<String>> viewers = new ArrayList<>();

    private OrgFleetResource resource(FleetData data) {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        org.setUserEmail("ana@example.com");
        TenantContext tenant = new TenantContext();
        tenant.setClientId("acme-client");
        tenant.setEffectiveClientIds(List.of("acme-client", "child-client"));
        FleetData recording = new DemoFleetData(CLOCK::instant) {
            @Override
            public List<AssetFacts> assets(Set<String> clientIds) {
                viewers.add(clientIds);
                return data.assets(clientIds);
            }
        };
        return new OrgFleetResource(tenant, org, null, new FleetDirectoryService(recording,
                new InMemoryProfileStore(), new InMemoryActivityStore(), CLOCK, ZoneId.of("America/Santiago"),
                Duration.ZERO));
    }

    private final OrgFleetResource resource = resource(new DemoFleetData(CLOCK::instant));

    private static Response call(Uni<Response> uni) {
        return uni.await().atMost(WAIT);
    }

    @Test
    void readsWithTheOrganizationsClients() {
        Response page = call(resource.assets(ORG, null, "truck", null, null, false, false, null, 0, 50));
        assertEquals(200, page.getStatus());
        assertEquals(4, ((Views.AssetPage) page.getEntity()).total());
        assertEquals(Set.of("acme-client", "child-client"), viewers.get(0));

        Response updated = call(resource.update(ORG, "DEMO-TR1",
                new Views.AssetUpdate(Map.of("label", "Tracto 1"), Map.of())));
        Views.AssetDetail detail = (Views.AssetDetail) updated.getEntity();
        assertEquals("Tracto 1", detail.label());
        assertEquals("ana@example.com", detail.changes().get(0).changedBy());
    }

    @Test
    void anotherOrganizationInThePathIsForbidden() {
        WebApplicationException e = assertThrows(WebApplicationException.class,
                () -> resource.asset("other", "DEMO-TR1"));
        assertEquals(403, e.getResponse().getStatus());
    }

    @Test
    void errorsMapToStatusCodes() {
        assertEquals(404, call(resource.asset(ORG, "NOPE")).getStatus());
        assertEquals(400, call(resource.update(ORG, "DEMO-TR1",
                new Views.AssetUpdate(Map.of("year", "abc"), Map.of()))).getStatus());
        assertEquals(404, call(resource.accept(ORG, "DEMO-JX1", "USUAL_TRAILER")).getStatus());
        WebApplicationException badKind = assertThrows(WebApplicationException.class,
                () -> resource.assets(ORG, null, "bus", null, null, false, false, null, 0, 50));
        assertEquals(400, badKind.getResponse().getStatus());

        OrgFleetResource unavailable = resource(new DemoFleetData(CLOCK::instant) {
            @Override
            public List<AssetFacts> assets(Set<String> clientIds) {
                throw new FleetUnavailableException("Fleet data is not configured");
            }
        });
        assertEquals(503, call(unavailable.asset(ORG, "DEMO-TR1")).getStatus());
    }
}

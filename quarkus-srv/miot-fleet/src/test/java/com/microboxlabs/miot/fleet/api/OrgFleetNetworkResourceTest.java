package com.microboxlabs.miot.fleet.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.fleet.network.AssetView;
import com.microboxlabs.miot.fleet.network.DemoNetworkSource;
import com.microboxlabs.miot.fleet.network.EvidenceSource;
import com.microboxlabs.miot.fleet.network.FleetNetworkService;
import com.microboxlabs.miot.fleet.network.NetworkPolicy;
import com.microboxlabs.miot.fleet.network.NetworkSource;
import com.microboxlabs.miot.fleet.network.NetworkUnavailableException;
import com.microboxlabs.miot.fleet.network.RelationshipView;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The path organization must be the resolved one; missing assets are 404 and an unset source is 503. */
class OrgFleetNetworkResourceTest {

    private static final String ORG = "acme";
    private static final Duration WAIT = Duration.ofSeconds(5);
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-14T12:00:00Z"), ZoneOffset.UTC);
    private static final NetworkPolicy POLICY = new NetworkPolicy(Map.of(
            EvidenceSource.SIGNAL, Duration.ofDays(30),
            EvidenceSource.TRIP, Duration.ofDays(7),
            EvidenceSource.ACCREDITATION, Duration.ofDays(30)));

    private final List<String> viewers = new ArrayList<>();

    private OrgFleetNetworkResource resource(NetworkSource source) {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        TenantContext tenant = new TenantContext();
        tenant.setClientId("acme-client");
        tenant.setEffectiveClientIds(List.of("acme-client", "child-client"));
        NetworkSource recording = viewer -> {
            viewers.add(viewer.organizationId() + "/" + viewer.clientIds());
            return source.load(viewer);
        };
        return new OrgFleetNetworkResource(tenant, org, new FleetNetworkService(recording, POLICY, CLOCK));
    }

    private final OrgFleetNetworkResource resource = resource(new DemoNetworkSource(CLOCK::instant));

    private static String sorted(String viewer) {
        int slash = viewer.indexOf('/');
        String ids = viewer.substring(slash + 2, viewer.length() - 1);
        return viewer.substring(0, slash) + "/" + java.util.Arrays.stream(ids.split(", ")).sorted().toList();
    }

    private static Response call(Uni<Response> uni) {
        return uni.await().atMost(WAIT);
    }

    @Test
    void readsAsThePathOrganization() {
        Response assets = call(resource.assets(ORG));
        assertEquals(200, assets.getStatus());
        assertEquals(5, ((List<?>) assets.getEntity()).size());

        Response asset = call(resource.asset(ORG, "JAULA-01"));
        assertEquals("JAULA-01", ((AssetView) asset.getEntity()).id());

        Response relationships = call(resource.relationships(ORG));
        assertEquals(2, ((List<?>) relationships.getEntity()).size());
        assertEquals(RelationshipView.class, ((List<?>) relationships.getEntity()).get(0).getClass());

        assertEquals(List.of("acme/[acme-client, child-client]", "acme/[acme-client, child-client]",
                "acme/[acme-client, child-client]"), viewers.stream().map(OrgFleetNetworkResourceTest::sorted).toList());
    }

    @Test
    void anAssetTheOrganizationDoesNotSeeIs404() {
        Response response = call(resource.asset(ORG, "QRST90"));
        assertEquals(404, response.getStatus());
        assertEquals(Map.of("error", "Asset not found: QRST90"), response.getEntity());
    }

    @Test
    void anUnsetSourceIs503() {
        OrgFleetNetworkResource unset = resource(viewer -> {
            throw new NetworkUnavailableException("Fleet network data is not configured");
        });
        Response response = call(unset.assets(ORG));
        assertEquals(503, response.getStatus());
        assertEquals(Map.of("error", "Fleet network data is not configured"), response.getEntity());
    }

    @Test
    void anotherOrganizationInThePathIsRefused() {
        WebApplicationException e = assertThrows(WebApplicationException.class, () -> resource.assets("other"));
        assertEquals(403, e.getResponse().getStatus());
        assertEquals(List.of(), viewers);
    }
}

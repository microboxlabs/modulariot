package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.integrations.orgaccount.GoogleCallException;
import com.microboxlabs.miot.integrations.orgaccount.OrgServiceAccountService;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PlatformOrgServiceAccountResourceTest {

    private static final PlatformOrgServiceAccountResource.Org ORG =
            new PlatformOrgServiceAccountResource.Org("client-1", "Acme");

    private static Response failingWith(RuntimeException error) {
        return PlatformOrgServiceAccountResource.respond(ORG, "owner@example.com", (org, actor) -> {
            throw error;
        });
    }

    @Test
    void mapsServiceFailuresToStatuses() throws Exception {
        assertEquals(503, failingWith(newInstance(OrgServiceAccountService.NotConfiguredException.class)).getStatus());
        assertEquals(404, failingWith(newInstance(OrgServiceAccountService.NotFoundException.class)).getStatus());
        Response google = failingWith(new GoogleCallException(403, "Permission denied"));
        assertEquals(502, google.getStatus());
        assertEquals(Map.of("error", "Permission denied"), google.getEntity());
    }

    @Test
    void passesTheOrganizationAndActorThrough() {
        Response ok = PlatformOrgServiceAccountResource.respond(ORG, "owner@example.com",
                (org, actor) -> Response.ok(org.tenantCode() + " " + actor).build());
        assertEquals(200, ok.getStatus());
        assertEquals("client-1 owner@example.com", ok.getEntity());
    }

    private static <T extends RuntimeException> T newInstance(Class<T> type) throws Exception {
        var constructor = type.getDeclaredConstructor();
        constructor.setAccessible(true);
        return constructor.newInstance();
    }
}

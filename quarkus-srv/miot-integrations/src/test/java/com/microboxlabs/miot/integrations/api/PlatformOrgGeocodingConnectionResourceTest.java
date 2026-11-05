package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.integrations.geocoding.ManagedGeocodingConnections;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PlatformOrgGeocodingConnectionResourceTest {

    private static Response failingWith(RuntimeException error) {
        return PlatformOrgGeocodingConnectionResource.respond("client-1", "owner@example.com", (tenant, actor) -> {
            throw error;
        });
    }

    @Test
    void mapsServiceFailuresToStatuses() throws Exception {
        Response noProvider = failingWith(newInstance(ManagedGeocodingConnections.NoPlatformProviderException.class));
        assertEquals(409, noProvider.getStatus());
        assertEquals(Map.of("error", "Set the platform's geocoding provider in Settings › Connections, under the Platform scope, first"),
                noProvider.getEntity());
        assertEquals(400, failingWith(newInstance(ManagedGeocodingConnections.PlatformTenantException.class))
                .getStatus());
    }

    @Test
    void passesTheTenantAndActorThrough() {
        Response ok = PlatformOrgGeocodingConnectionResource.respond("client-1", "owner@example.com",
                (tenant, actor) -> Response.ok(tenant + " " + actor).build());
        assertEquals(200, ok.getStatus());
        assertEquals("client-1 owner@example.com", ok.getEntity());
    }

    private static <T extends RuntimeException> T newInstance(Class<T> type) throws Exception {
        var constructor = type.getDeclaredConstructor();
        constructor.setAccessible(true);
        return constructor.newInstance();
    }
}

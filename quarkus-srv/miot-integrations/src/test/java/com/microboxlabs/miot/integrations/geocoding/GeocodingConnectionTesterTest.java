package com.microboxlabs.miot.integrations.geocoding;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.service.ConnectionNotConfiguredException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GeocodingConnectionTesterTest {

    private HttpServer server;
    private URI base;
    private final Map<String, ResolvedConnection> byTenant = new HashMap<>();
    private final AtomicReference<String> path = new AtomicReference<>();
    private volatile String body = "";

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            path.set(exchange.getRequestURI().getPath());
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void anOrganizationsConnectionIsTestedThroughThePlatformsMapboxToken() {
        platform("mapbox");
        body = "{\"code\":\"TokenValid\",\"token\":{\"usage\":\"pk\",\"user\":\"korutx-mbl\"}}";

        ConnectionTestResponse result = tester().test(null, null, null);

        assertTrue(result.success());
        assertEquals("Valid pk token of korutx-mbl", result.message());
        assertEquals("/tokens/v2", path.get());
    }

    @Test
    void googleIsTestedWithOneGeocodingRequest() {
        platform("google");
        body = "{\"status\":\"REQUEST_DENIED\",\"results\":[]}";

        ConnectionTestResponse result = tester().test(null, null, null);

        assertFalse(result.success());
        assertEquals("Google answered REQUEST_DENIED", result.message());
        assertEquals("/maps/api/geocode/json", path.get());
    }

    @Test
    void withoutAPlatformProviderTheTestFailsWithoutACall() {
        ConnectionTestResponse result = tester().test(null, null, null);

        assertFalse(result.success());
        assertEquals("The platform has no geocoding provider; set it in the Plataforma scope", result.message());
        assertEquals(null, path.get());
    }

    private void platform(String provider) {
        byTenant.put(PLATFORM_TENANT, new ResolvedConnection("platform", base,
                Map.of(GeocodingConnection.PROVIDER, provider), Map.of(GeocodingConnection.TOKEN, "tok")));
    }

    private GeocodingConnectionTester tester() {
        IntegrationConnectionResolver resolver = new IntegrationConnectionResolver(null, null, null) {
            @Override
            public ResolvedConnection resolve(String tenantCode, ProviderType providerType) {
                ResolvedConnection c = byTenant.get(tenantCode);
                if (c == null) {
                    throw new ConnectionNotConfiguredException("none");
                }
                return c;
            }
        };
        return new GeocodingConnectionTester(resolver, new MapboxCredentialTester(base),
                new GoogleGeocoding(base, false));
    }
}

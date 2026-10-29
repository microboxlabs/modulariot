package com.microboxlabs.miot.integrations.geocoding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.dto.CredentialTestResponse;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MapboxCredentialTesterTest {

    private static final Map<String, Object> MAPBOX = Map.of("provider", "mapbox");

    private HttpServer server;
    private MapboxCredentialTester tester;
    private final AtomicReference<String> query = new AtomicReference<>();
    private volatile int status = 200;
    private volatile String body = "";

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/tokens/v2", exchange -> {
            query.set(exchange.getRequestURI().getRawQuery());
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        tester = new MapboxCredentialTester(URI.create("http://127.0.0.1:" + server.getAddress().getPort()));
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void onlyClaimsBearerTokensTaggedMapbox() {
        assertTrue(tester.supports(CredentialType.BEARER_TOKEN, MAPBOX));
        assertFalse(tester.supports(CredentialType.BEARER_TOKEN, Map.of()));
        assertFalse(tester.supports(CredentialType.BEARER_TOKEN, Map.of("provider", "google_maps")));
        assertFalse(tester.supports(CredentialType.BEARER_TOKEN));
    }

    @Test
    void aValidTokenPasses() {
        body = "{\"code\":\"TokenValid\",\"token\":{\"usage\":\"pk\",\"user\":\"korutx-mbl\"}}";

        CredentialTestResponse result = tester.test(CredentialType.BEARER_TOKEN, MAPBOX, Map.of("token", "pk.abc"));

        assertTrue(result.success());
        assertEquals("Valid pk token of korutx-mbl", result.message());
        assertEquals("access_token=pk.abc", query.get());
    }

    @Test
    void anInvalidTokenFailsWithMapboxsCode() {
        status = 401;
        body = "{\"code\":\"TokenInvalid\"}";

        CredentialTestResponse result = tester.test(CredentialType.BEARER_TOKEN, MAPBOX, Map.of("token", "pk.bad"));

        assertFalse(result.success());
        assertEquals("Mapbox rejected the token: TokenInvalid", result.message());
    }

    @Test
    void aMissingTokenFailsWithoutACall() {
        CredentialTestResponse result = tester.test(CredentialType.BEARER_TOKEN, MAPBOX, Map.of());

        assertFalse(result.success());
        assertEquals(null, query.get());
    }
}

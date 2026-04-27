package com.microboxlabs.miot.integrations.auth.oauth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.TokenRequestFormat;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class OAuth2ClientCredentialsStrategyTest {

    private HttpServer server;
    private String capturedContentType;
    private String capturedBody;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void resolvesClientCredentialsUsingFormUrlEncodedTokenRequest() throws Exception {
        URI tokenUrl = startTokenServer();
        OAuth2ClientCredentialsStrategy strategy = new OAuth2ClientCredentialsStrategy(
                HttpClient.newHttpClient(), new ObjectMapper());

        ResolvedAuth auth = strategy.resolve(OAuth2ClientCredentialsConfig.withoutOptionalClaims(
                tokenUrl,
                "Sitrans_AlerceCorViaje",
                "secret-value",
                TokenRequestFormat.FORM));

        assertEquals("application/x-www-form-urlencoded", capturedContentType);
        assertEquals("grant_type=client_credentials&client_id=Sitrans_AlerceCorViaje&client_secret=secret-value",
                capturedBody);
        assertEquals("Bearer alerce-token", auth.headers().get("Authorization"));
        assertTrue(auth.expiresAt().isAfter(java.time.Instant.now()));
    }

    private URI startTokenServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/oauth", this::handleTokenRequest);
        server.start();
        return URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/oauth");
    }

    private void handleTokenRequest(HttpExchange exchange) throws IOException {
        capturedContentType = exchange.getRequestHeaders().getFirst("Content-Type");
        capturedBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        byte[] response = "{\"access_token\":\"alerce-token\",\"expires_in\":120}".getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}

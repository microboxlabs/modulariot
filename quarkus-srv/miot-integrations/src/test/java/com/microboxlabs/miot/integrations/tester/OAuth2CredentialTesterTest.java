package com.microboxlabs.miot.integrations.tester;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.auth.oauth.OAuth2ClientCredentialsStrategy;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.dto.CredentialTestResponse;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * Exercises the tester against a real loopback token endpoint, the way
 * {@code OAuth2ClientCredentialsStrategyTest} does. Loopback is fine here because the
 * SSRF guard lives in the service, not the tester — reaching a token endpoint is
 * protocol, deciding which endpoints are allowed is policy.
 */
class OAuth2CredentialTesterTest {

    private HttpServer server;
    private int status = 200;
    private String body = "{\"access_token\":\"tok\",\"expires_in\":3599}";

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void reportsTheGrantedTokenLifetimeOnSuccess() throws Exception {
        CredentialTestResponse response = test(startTokenServer());

        assertTrue(response.success());
        assertEquals("Token issued", response.message());
        assertNotNull(response.expiresInSeconds());
        assertTrue(response.expiresInSeconds() > 3500, "expected roughly the granted hour");
    }

    /**
     * The operator's actual diagnosis. A wrong client secret comes back as
     * {@code invalid_client}, and that code is what tells them which field to fix.
     */
    @Test
    void surfacesTheProvidersErrorCodeOnRejection() throws Exception {
        status = 401;
        body = "{\"error\":\"invalid_client\",\"error_description\":\"AADSTS7000215: correlation 8f2c\"}";

        CredentialTestResponse response = test(startTokenServer());

        assertFalse(response.success());
        assertEquals("invalid_client (HTTP 401)", response.message());
        assertNull(response.expiresInSeconds());
    }

    /**
     * error_description carries correlation ids and echoed request detail, so it stays
     * server-side however useful it looks.
     */
    @Test
    void neverRepeatsTheProvidersErrorDescription() throws Exception {
        status = 400;
        body = "{\"error\":\"invalid_scope\",\"error_description\":\"AADSTS70011: correlation 8f2c\"}";

        CredentialTestResponse response = test(startTokenServer());

        assertFalse(response.message().contains("AADSTS70011"));
        assertFalse(response.message().contains("correlation"));
    }

    @Test
    void stillFailsUsefullyWhenTheProviderSendsNoErrorCode() throws Exception {
        status = 503;
        body = "<html>gateway</html>";

        CredentialTestResponse response = test(startTokenServer());

        assertFalse(response.success());
        assertEquals("The provider rejected the credential (HTTP 503)", response.message());
    }

    /** An incomplete config is the operator's own input, so it is named back to them. */
    @Test
    void reportsAnIncompleteConfigWithoutCallingAnything() {
        CredentialTestResponse response = tester().test(
                CredentialType.OAUTH2_CLIENT_CREDENTIALS,
                Map.of("clientId", "abc"),
                Map.of("clientSecret", "s3cret"));

        assertFalse(response.success());
        assertEquals("tokenUrl is required", response.message());
    }

    @Test
    void claimsBothOAuthTypesAndNothingElse() {
        OAuth2CredentialTester tester = tester();

        assertTrue(tester.supports(CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS));
        assertTrue(tester.supports(CredentialType.OAUTH2_CLIENT_CREDENTIALS));
        assertFalse(tester.supports(CredentialType.BEARER_TOKEN));
        assertFalse(tester.supports(CredentialType.API_KEY));
    }

    private CredentialTestResponse test(String tokenUrl) {
        return tester().test(
                CredentialType.OAUTH2_CLIENT_CREDENTIALS,
                Map.of("clientId", "partner-api", "tokenUrl", tokenUrl),
                Map.of("clientSecret", "s3cret"));
    }

    private OAuth2CredentialTester tester() {
        return new OAuth2CredentialTester(new OAuth2ClientCredentialsStrategy());
    }

    private String startTokenServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/oauth", this::handleTokenRequest);
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/oauth";
    }

    private void handleTokenRequest(HttpExchange exchange) throws IOException {
        exchange.getRequestBody().readAllBytes();
        byte[] response = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}

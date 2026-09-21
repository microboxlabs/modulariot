package com.microboxlabs.miot.integrations.auth.google;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.auth.oauth.OAuth2TokenException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class GoogleServiceAccountStrategyTest {

    private static final String EMAIL = "reader@project.iam.gserviceaccount.com";
    private static final Clock CLOCK = Clock.fixed(Instant.ofEpochSecond(1_700_000_000), ZoneOffset.UTC);
    private static KeyPair keyPair;
    private static String pem;

    private HttpServer server;
    private String capturedBody;
    private int status = 200;
    private String answer = "{\"access_token\":\"ya29.granted\",\"expires_in\":3599}";

    @BeforeAll
    static void generateKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        keyPair = generator.generateKeyPair();
        pem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII))
                        .encodeToString(keyPair.getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----\n";
    }

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void signsTheAssertionWithTheKeyAndNamesTheAccount() throws Exception {
        GoogleServiceAccountConfig config = config(URI.create("https://oauth2.googleapis.com/token"));

        String assertion = strategy().signAssertion(config);
        String[] parts = assertion.split("\\.");

        assertEquals(3, parts.length);
        JsonNode claims = new ObjectMapper().readTree(Base64.getUrlDecoder().decode(parts[1]));
        assertEquals(EMAIL, claims.get("iss").asText());
        assertEquals(GoogleServiceAccountConfigs.DEFAULT_SCOPE, claims.get("scope").asText());
        assertEquals("https://oauth2.googleapis.com/token", claims.get("aud").asText());
        assertEquals(1_700_000_000L, claims.get("iat").asLong());
        assertEquals(1_700_003_600L, claims.get("exp").asLong());

        Signature verifier = Signature.getInstance("SHA256withRSA");
        verifier.initVerify(keyPair.getPublic());
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertTrue(verifier.verify(Base64.getUrlDecoder().decode(parts[2])));
    }

    @Test
    void acceptsAKeyWithEscapedLineBreaks() {
        GoogleServiceAccountConfig config = new GoogleServiceAccountConfig(
                EMAIL, pem.replace("\n", "\\n"), GoogleServiceAccountConfigs.DEFAULT_SCOPE,
                URI.create("https://oauth2.googleapis.com/token"));

        assertEquals(3, strategy().signAssertion(config).split("\\.").length);
    }

    @Test
    void namesABadKeyWithoutQuotingIt() {
        GoogleServiceAccountConfig config = new GoogleServiceAccountConfig(
                EMAIL, "-----BEGIN PRIVATE KEY-----\nbm90IGEga2V5\n-----END PRIVATE KEY-----",
                GoogleServiceAccountConfigs.DEFAULT_SCOPE, URI.create("https://oauth2.googleapis.com/token"));

        AuthResolutionException failure =
                assertThrows(AuthResolutionException.class, () -> strategy().signAssertion(config));
        assertEquals("The private key is not a usable RSA key", failure.getMessage());
    }

    @Test
    void exchangesTheAssertionForABearerHeader() throws Exception {
        URI tokenUrl = startTokenServer();

        ResolvedAuth auth = strategy().resolve(config(tokenUrl));

        assertEquals("Bearer ya29.granted", auth.headers().get("Authorization"));
        assertEquals(Instant.ofEpochSecond(1_700_000_000 + 3599), auth.expiresAt());
        String decoded = URLDecoder.decode(capturedBody, StandardCharsets.UTF_8);
        assertTrue(decoded.startsWith("grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion="));
        assertFalse(decoded.contains("PRIVATE KEY"));
    }

    @Test
    void reportsARefusalByItsCodeOnly() throws Exception {
        status = 400;
        answer = "{\"error\":\"invalid_grant\",\"error_description\":\"Invalid JWT Signature for " + EMAIL + "\"}";
        URI tokenUrl = startTokenServer();

        OAuth2TokenException failure =
                assertThrows(OAuth2TokenException.class, () -> strategy().resolve(config(tokenUrl)));

        assertEquals(400, failure.statusCode());
        assertEquals("invalid_grant", failure.errorCode());
        assertFalse(failure.getMessage().contains("Invalid JWT Signature"));
    }

    private static GoogleServiceAccountConfig config(URI tokenUrl) {
        return new GoogleServiceAccountConfig(EMAIL, pem, GoogleServiceAccountConfigs.DEFAULT_SCOPE, tokenUrl);
    }

    private static GoogleServiceAccountStrategy strategy() {
        return new GoogleServiceAccountStrategy(HttpClient.newHttpClient(), new ObjectMapper(), CLOCK);
    }

    private URI startTokenServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/token", this::handle);
        server.start();
        return URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/token");
    }

    private void handle(HttpExchange exchange) throws IOException {
        capturedBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        byte[] response = answer.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, response.length);
        exchange.getResponseBody().write(response);
        exchange.close();
    }
}

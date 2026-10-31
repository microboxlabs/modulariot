package com.microboxlabs.miot.integrations.tester;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class WhatsAppConnectionTesterTest {

    private static final String PHONE_NUMBER_ID = "1188646904321987";
    private static final String TOKEN = "EAAtest-token";

    private final IntegrationSecretCipher cipher =
            new IntegrationSecretCipher(new ObjectMapper(), "unit-test-key");
    private final WhatsAppConnectionTester tester =
            new WhatsAppConnectionTester(HttpClient.newHttpClient(), cipher);

    private HttpServer server;
    private final AtomicReference<String> seenAuthHeader = new AtomicReference<>();
    private final AtomicReference<String> seenPath = new AtomicReference<>();
    private final AtomicReference<String> seenQuery = new AtomicReference<>();

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void returnsSuccessWhenMetaReturns2xx() throws IOException {
        startServer(200, "{\"id\":\"" + PHONE_NUMBER_ID + "\",\"display_phone_number\":\"+56 9 0000 0001\"}");
        IntegrationConnection connection = connection(URI.create(baseUrl()), Map.of("phone_number_id", PHONE_NUMBER_ID));

        ConnectionTestResponse response = tester.test(connection, bearerCredential(TOKEN), new ConnectionTestRequest("GET", null));

        assertTrue(response.success());
        assertTrue(response.message().contains("OK"));
        assertEquals("Bearer " + TOKEN, seenAuthHeader.get());
        assertEquals("/" + PHONE_NUMBER_ID, seenPath.get());
    }

    @Test
    void provesTheAppSecretAndReportsTheWebhookKeys() throws Exception {
        startServer(200, "{\"id\":\"" + PHONE_NUMBER_ID + "\"}");
        IntegrationConnection connection = connection(URI.create(baseUrl()), Map.of("phone_number_id", PHONE_NUMBER_ID));

        ConnectionTestResponse response = tester.test(connection,
                credential(Map.of("token", TOKEN, "app_secret", "signing", "verify_token", "verify")),
                new ConnectionTestRequest("GET", null));

        assertTrue(response.success());
        assertEquals("appsecret_proof=" + hmac("signing", TOKEN), seenQuery.get());
        assertTrue(response.message().contains("App secret OK; verify token saved."));
    }

    @Test
    void failsWhenTheAppSecretIsNotTheTokensApp() throws IOException {
        startServer(400, "{\"error\":{\"message\":\"Invalid appsecret_proof provided in the API argument\"}}");
        IntegrationConnection connection = connection(URI.create(baseUrl()), Map.of("phone_number_id", PHONE_NUMBER_ID));

        ConnectionTestResponse response = tester.test(connection,
                credential(Map.of("token", TOKEN, "app_secret", "wrong")), new ConnectionTestRequest("GET", null));

        assertFalse(response.success());
        assertTrue(response.message().contains("App secret does not belong"));
    }

    @Test
    void saysWhichWebhookKeysAreMissing() throws IOException {
        startServer(200, "{\"id\":\"" + PHONE_NUMBER_ID + "\"}");
        IntegrationConnection connection = connection(URI.create(baseUrl()), Map.of("phone_number_id", PHONE_NUMBER_ID));

        ConnectionTestResponse response = tester.test(connection, bearerCredential(TOKEN),
                new ConnectionTestRequest("GET", null));

        assertTrue(response.success());
        assertEquals(null, seenQuery.get());
        assertTrue(response.message().contains("App secret not set"));
        assertTrue(response.message().contains("verify token not set"));
    }

    @Test
    void returnsFailureWhenMetaRejectsToken() throws IOException {
        startServer(401, "{\"error\":{\"message\":\"Invalid OAuth access token\"}}");
        IntegrationConnection connection = connection(URI.create(baseUrl()), Map.of("phone_number_id", PHONE_NUMBER_ID));

        ConnectionTestResponse response = tester.test(connection, bearerCredential(TOKEN), new ConnectionTestRequest("GET", null));

        assertFalse(response.success());
        assertTrue(response.message().contains("401"));
    }

    @Test
    void failsFastWhenPhoneNumberIdMissing() {
        IntegrationConnection connection = connection(URI.create("https://graph.facebook.com/v25.0"), Map.of());

        ConnectionTestResponse response = tester.test(connection, bearerCredential(TOKEN), new ConnectionTestRequest("GET", null));

        assertFalse(response.success());
        assertTrue(response.message().contains("phone_number_id"));
    }

    @Test
    void failsWhenNoCredentialLinked() {
        IntegrationConnection connection =
                connection(URI.create("https://graph.facebook.com/v25.0"), Map.of("phone_number_id", PHONE_NUMBER_ID));

        ConnectionTestResponse response = tester.test(connection, null, new ConnectionTestRequest("GET", null));

        assertFalse(response.success());
        assertTrue(response.message().contains("credential"));
    }

    @Test
    void supportsOnlyWhatsApp() {
        assertTrue(tester.supports(ProviderType.WHATSAPP));
        assertFalse(tester.supports(ProviderType.N8N));
    }

    private void startServer(int status, String body) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            seenAuthHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
            seenPath.set(exchange.getRequestURI().getPath());
            seenQuery.set(exchange.getRequestURI().getQuery());
            byte[] payload = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, payload.length);
            exchange.getResponseBody().write(payload);
            exchange.close();
        });
        server.start();
    }

    private String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private static String hmac(String key, String value) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    }

    private CredentialProfile bearerCredential(String token) {
        return credential(Map.of("token", token));
    }

    private CredentialProfile credential(Map<String, Object> secret) {
        String encrypted = cipher.encrypt(secret);
        assertNotNull(encrypted);
        OffsetDateTime now = OffsetDateTime.now();
        return new CredentialProfile(
                UUID.randomUUID().toString(),
                "tenant-1",
                "WhatsApp Cloud Token",
                CredentialType.BEARER_TOKEN,
                AuthType.BEARER_TOKEN,
                "PRODUCTION",
                Map.of(),
                encrypted,
                "****",
                1,
                null,
                null,
                now,
                now,
                null,
                null);
    }

    private IntegrationConnection connection(URI baseUrl, Map<String, Object> metadata) {
        return new IntegrationConnection(
                UUID.randomUUID().toString(),
                "tenant-1",
                "WhatsApp Prod",
                ProviderType.WHATSAPP,
                baseUrl,
                UUID.randomUUID().toString(),
                ConnectionStatus.DRAFT,
                null,
                null,
                metadata);
    }
}

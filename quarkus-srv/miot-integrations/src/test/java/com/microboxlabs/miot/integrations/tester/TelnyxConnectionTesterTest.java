package com.microboxlabs.miot.integrations.tester;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import com.microboxlabs.miot.integrations.telephony.StubHttp;
import com.microboxlabs.miot.integrations.telephony.TelnyxClient;
import java.io.IOException;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TelnyxConnectionTesterTest {

    private static final URI API = URI.create("https://api.telnyx.test");
    private static final Map<String, Object> METADATA = Map.of("sipConnectionId", "sip-1",
            "callerNumber", "+56 9 0000 0000");

    private final IntegrationSecretCipher cipher = new IntegrationSecretCipher(new ObjectMapper(), "unit-test-key");
    private final StubHttp http = new StubHttp();
    private final TelnyxConnectionTester tester = new TelnyxConnectionTester(new TelnyxClient(http, API), cipher);

    @Test
    void aValidKeyAndSipConnectionPass() {
        http.reply("/v2/balance", 200, "{\"data\":{\"balance\":\"1.00\"}}")
                .reply("/v2/credential_connections/sip-1", 200, "{\"data\":{\"id\":\"sip-1\"}}");

        ConnectionTestResponse response = tester.test(connection(API, METADATA), credential("KEY_test"), null);

        assertTrue(response.success(), response.message());
        assertEquals("Bearer KEY_test", http.seen().get(0).header("Authorization"));
        assertEquals("/v2/credential_connections/sip-1", http.last().path());
    }

    @Test
    void aRejectedKeyFails() {
        http.reply("/v2/balance", 401, "{\"errors\":[]}");

        ConnectionTestResponse response = tester.test(connection(API, METADATA), credential("KEY_bad"), null);

        assertFalse(response.success());
        assertTrue(response.message().contains("rejected"), response.message());
    }

    @Test
    void anUnknownSipConnectionFails() {
        http.reply("/v2/balance", 200, "{}");

        ConnectionTestResponse response = tester.test(connection(API, METADATA), credential("KEY_test"), null);

        assertFalse(response.success());
        assertTrue(response.message().contains("sip-1"), response.message());
    }

    @Test
    void theNumberTheSipIdAndTheKeyAreRequired() {
        assertFalse(tester.test(connection(API, Map.of("sipConnectionId", "sip-1", "callerNumber", "12345")),
                credential("KEY"), null).success());
        assertFalse(tester.test(connection(API, Map.of("callerNumber", "+56900000000")), credential("KEY"), null)
                .success());
        assertFalse(tester.test(connection(API, METADATA), null, null).success());
        assertFalse(tester.test(connection(API, METADATA), credential(" "), null).success());
        assertTrue(http.seen().isEmpty(), "nothing is sent before the values are complete");
    }

    @Test
    void theKeyIsNeverSentToAnotherHost() {
        ConnectionTestResponse response = tester.test(connection(URI.create("https://elsewhere.test"), METADATA),
                credential("KEY"), null);

        assertFalse(response.success());
        assertTrue(http.seen().isEmpty());
    }

    @Test
    void aNetworkErrorFails() {
        http.failWith(new IOException("connection reset"));

        ConnectionTestResponse response = tester.test(connection(API, METADATA), credential("KEY"), null);

        assertFalse(response.success());
        assertTrue(response.message().contains("connection reset"));
    }

    @Test
    void aMalformedBearerKeyFailsWithoutExposingTheSecretOrSendingARequest() {
        String key = "KEY_sensitive\ninvalid";
        ConnectionTestResponse response = tester.test(connection(API, METADATA), credential(key), null);
        assertFalse(response.success());
        assertEquals("The API key is not a valid HTTP bearer token", response.message());
        assertFalse(response.message().contains("KEY_sensitive"));
        assertTrue(http.seen().isEmpty());
    }

    private static IntegrationConnection connection(URI baseUrl, Map<String, Object> metadata) {
        return new IntegrationConnection("conn-1", "tenant", "Telnyx", ProviderType.TELNYX, baseUrl, "cred-1",
                ConnectionStatus.DRAFT, null, null, metadata);
    }

    private CredentialProfile credential(String token) {
        OffsetDateTime now = OffsetDateTime.now();
        return new CredentialProfile("cred-1", "tenant", "Telnyx", CredentialType.BEARER_TOKEN, AuthType.BEARER_TOKEN,
                "PRODUCTION", Map.of("provider", "telnyx"), cipher.encrypt(Map.of("token", token)), "****", 1, null,
                null, now, now, null, null);
    }
}

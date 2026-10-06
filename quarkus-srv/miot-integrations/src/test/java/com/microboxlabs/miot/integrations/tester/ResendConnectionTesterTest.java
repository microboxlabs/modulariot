package com.microboxlabs.miot.integrations.tester;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import com.microboxlabs.miot.integrations.email.FakeResend;
import com.microboxlabs.miot.integrations.email.ResendClient;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import java.io.IOException;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ResendConnectionTesterTest {

    private static final Map<String, Object> SENDER = Map.of("from", "Team <no-reply@example.test>");

    private final IntegrationSecretCipher cipher = new IntegrationSecretCipher(new ObjectMapper(), "unit-test-key");
    private final ConnectionTestRequest request = new ConnectionTestRequest("GET", null);

    private ResendConnectionTester tester(URI api) {
        return new ResendConnectionTester(new ResendClient(new ObjectMapper(), api), cipher);
    }

    @Test
    void aFullAccessKeyPasses() throws IOException {
        try (FakeResend resend = new FakeResend().reply("/domains", 200, "{\"data\":[]}")) {
            ConnectionTestResponse response = tester(resend.baseUrl()).test(connection(resend.baseUrl(), SENDER), credential("re_full"), request);

            assertTrue(response.success(), response.message());
            assertEquals("Bearer re_full", resend.last().headers().get("authorization"));
        }
    }

    @Test
    void aSendOnlyKeyPasses() throws IOException {
        try (FakeResend resend = new FakeResend().reply("/domains", 401,
                "{\"statusCode\":401,\"name\":\"restricted_api_key\",\"message\":\"This API key is restricted\"}")) {
            ConnectionTestResponse response = tester(resend.baseUrl()).test(connection(resend.baseUrl(), SENDER), credential("re_send"), request);

            assertTrue(response.success(), response.message());
        }
    }

    @Test
    void aRejectedKeyFails() throws IOException {
        try (FakeResend resend = new FakeResend().reply("/domains", 401,
                "{\"statusCode\":401,\"name\":\"validation_error\",\"message\":\"API key is invalid\"}")) {
            ConnectionTestResponse response = tester(resend.baseUrl()).test(connection(resend.baseUrl(), SENDER), credential("re_bad"), request);

            assertFalse(response.success());
            assertTrue(response.message().contains("401"));
        }
    }

    @Test
    void aSenderAndAKeyAreRequired() {
        URI base = URI.create("http://127.0.0.1:1");
        ResendConnectionTester tester = tester(base);
        assertFalse(tester.test(connection(base, Map.of()), credential("re_x"), request).success());
        assertFalse(tester.test(connection(base, Map.of("from", "not-an-address@")), credential("re_x"), request)
                .success());
        assertFalse(tester.test(connection(base, SENDER), null, request).success());
        assertFalse(tester.test(connection(base, SENDER), credential(""), request).success());
    }

    @Test
    void theKeyIsNeverSentToAnotherHost() throws IOException {
        try (FakeResend elsewhere = new FakeResend().reply("/domains", 200, "{\"data\":[]}")) {
            ConnectionTestResponse response = tester(URI.create("https://api.resend.com"))
                    .test(connection(elsewhere.baseUrl(), SENDER), credential("re_full"), request);

            assertFalse(response.success());
            assertTrue(response.message().contains("https://api.resend.com"));
            assertNull(elsewhere.last());
        }
    }

    private static IntegrationConnection connection(URI baseUrl, Map<String, Object> metadata) {
        return new IntegrationConnection(UUID.randomUUID().toString(), "tenant", "Email", ProviderType.RESEND, baseUrl,
                "cred-1", ConnectionStatus.DRAFT, null, null, metadata);
    }

    private CredentialProfile credential(String token) {
        OffsetDateTime now = OffsetDateTime.now();
        return new CredentialProfile("cred-1", "tenant", "Resend", CredentialType.BEARER_TOKEN, AuthType.BEARER_TOKEN,
                "PRODUCTION", Map.of(), cipher.encrypt(Map.of("token", token)), "****", 1, null, null, now, now, null,
                null);
    }
}

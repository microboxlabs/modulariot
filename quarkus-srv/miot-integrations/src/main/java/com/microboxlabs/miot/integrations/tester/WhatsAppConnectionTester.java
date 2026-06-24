package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Live connectivity check for a WHATSAPP connection. Calls
 * {@code GET {baseUrl}/{phone_number_id}} on the Meta Graph API with the connection's
 * bearer access token (resolved from the linked credential profile). A 2xx response
 * means the token + phone-number-id are valid.
 */
@ApplicationScoped
public class WhatsAppConnectionTester implements ConnectionTester {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);
    private static final String PHONE_NUMBER_ID = "phone_number_id";

    private final HttpClient httpClient;
    private final IntegrationSecretCipher secretCipher;

    @Inject
    public WhatsAppConnectionTester(IntegrationSecretCipher secretCipher) {
        this(HttpClient.newHttpClient(), secretCipher);
    }

    WhatsAppConnectionTester(HttpClient httpClient, IntegrationSecretCipher secretCipher) {
        this.httpClient = httpClient;
        this.secretCipher = secretCipher;
    }

    @Override
    public boolean supports(ProviderType providerType) {
        return providerType == ProviderType.WHATSAPP;
    }

    @Override
    public ConnectionTestResponse test(
            IntegrationConnection connection,
            CredentialProfile credential,
            ConnectionTestRequest request) {
        OffsetDateTime now = OffsetDateTime.now();

        if (connection.baseUrl() == null) {
            return fail(now, "Connection base URL is not set (expected https://graph.facebook.com/<version>)");
        }
        String phoneNumberId = metadataString(connection, PHONE_NUMBER_ID);
        if (phoneNumberId == null || phoneNumberId.isBlank()) {
            return fail(now, "metadata.phone_number_id is required for a WhatsApp connection");
        }
        if (credential == null) {
            return fail(now, "No credential profile is linked to this connection");
        }

        String token;
        try {
            Map<String, Object> secret = secretCipher.decrypt(credential.encryptedSecretJson());
            Object value = secret.get("token");
            token = value == null ? null : value.toString();
        } catch (RuntimeException e) {
            return fail(now, "Could not read the access token from the credential profile");
        }
        if (token == null || token.isBlank()) {
            return fail(now, "Credential profile does not contain a 'token' secret");
        }

        URI uri = URI.create(trimTrailingSlash(connection.baseUrl().toString()) + "/" + phoneNumberId);
        HttpRequest httpRequest = HttpRequest.newBuilder(uri)
                .timeout(REQUEST_TIMEOUT)
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            return fail(now, "Could not reach Meta Graph API: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return fail(now, "WhatsApp connection test was interrupted");
        }

        int status = response.statusCode();
        if (status >= 200 && status < 300) {
            return new ConnectionTestResponse(true, now,
                    "WhatsApp connection OK — Meta returned HTTP " + status + " for phone number " + phoneNumberId);
        }
        return fail(now,
                "Meta Graph API returned HTTP " + status + " — check the access token and phone_number_id");
    }

    private static String metadataString(IntegrationConnection connection, String key) {
        Map<String, Object> metadata = connection.metadata();
        if (metadata == null) {
            return null;
        }
        Object value = metadata.get(key);
        return value == null ? null : value.toString();
    }

    private static String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static ConnectionTestResponse fail(OffsetDateTime testedAt, String message) {
        return new ConnectionTestResponse(false, testedAt, message);
    }
}

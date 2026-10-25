package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import com.microboxlabs.miot.integrations.service.WhatsAppWebhookKeys;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Live connectivity check for a WHATSAPP connection. Calls
 * {@code GET {baseUrl}/{phone_number_id}} on the Meta Graph API with the connection's
 * bearer access token (resolved from the linked credential profile). A 2xx response
 * means the token + phone-number-id are valid. When the credential holds the Meta App
 * secret the call carries {@code appsecret_proof}, so Meta also confirms the secret belongs
 * to the token's app; the message then says which webhook keys are stored.
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
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

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

        Map<String, Object> secret;
        try {
            secret = secretCipher.decrypt(credential.encryptedSecretJson());
        } catch (RuntimeException e) {
            return fail(now, "Could not read the access token from the credential profile");
        }
        String token = text(secret.get("token"));
        if (token.isBlank()) {
            return fail(now, "Credential profile does not contain a 'token' secret");
        }
        String appSecret = text(secret.get(WhatsAppWebhookKeys.APP_SECRET));
        boolean verifyTokenSet = !text(secret.get(WhatsAppWebhookKeys.VERIFY_TOKEN)).isBlank();

        // With appsecret_proof Meta also checks that the App secret belongs to the token's app.
        String proof = appSecret.isBlank() ? "" : "?appsecret_proof=" + hmacSha256Hex(appSecret, token);
        URI uri = URI.create(trimTrailingSlash(connection.baseUrl().toString()) + "/" + phoneNumberId + proof);
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
                    "WhatsApp connection OK — Meta returned HTTP " + status + " for phone number " + phoneNumberId
                            + ". " + webhookSummary(!appSecret.isBlank(), verifyTokenSet));
        }
        String body = response.body();
        if (!appSecret.isBlank() && body != null && body.contains("appsecret_proof")) {
            return fail(now, "The App secret does not belong to the Meta app of the access token");
        }
        return fail(now,
                "Meta Graph API returned HTTP " + status + " — check the access token and phone_number_id");
    }

    /** What the webhook can do with the stored keys: a missing one means replies cannot be received. */
    private static String webhookSummary(boolean appSecretSet, boolean verifyTokenSet) {
        String appSecret = appSecretSet ? "App secret OK" : "App secret not set: replies cannot be received";
        String verifyToken = verifyTokenSet
                ? "verify token saved"
                : "verify token not set: Meta cannot verify the webhook";
        return appSecret + "; " + verifyToken + ".";
    }

    private static String hmacSha256Hex(String key, String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 is not available", e);
        }
    }

    private static String text(Object value) {
        return value == null ? "" : value.toString();
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

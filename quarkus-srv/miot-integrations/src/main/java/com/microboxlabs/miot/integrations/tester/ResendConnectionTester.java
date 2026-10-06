package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.email.ResendClient;
import com.microboxlabs.miot.integrations.email.ResendEmailSender;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;

/**
 * Checks a RESEND connection without sending email: a sender is set, the credential holds an
 * API key, and Resend accepts the key on {@code GET /domains}. A send-only key answers 401
 * {@code restricted_api_key}, which still proves the key is valid.
 */
@ApplicationScoped
public class ResendConnectionTester implements ConnectionTester {

    private static final String RESTRICTED_KEY = "restricted_api_key";

    private final ResendClient client;
    private final IntegrationSecretCipher secretCipher;

    @Inject
    public ResendConnectionTester(ResendClient client, IntegrationSecretCipher secretCipher) {
        this.client = client;
        this.secretCipher = secretCipher;
    }

    @Override
    public boolean supports(ProviderType providerType) {
        return providerType == ProviderType.RESEND;
    }

    @Override
    public ConnectionTestResponse test(IntegrationConnection connection, CredentialProfile credential,
            ConnectionTestRequest request) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (!ResendEmailSender.validSender(sender(connection))) {
            return fail(now, "metadata.from must be a sender address, e.g. Team <no-reply@example.com>");
        }
        if (!client.serves(connection.baseUrl())) {
            return fail(now, "The base URL must be " + client.baseUrl());
        }
        if (credential == null) {
            return fail(now, "No credential profile is linked to this connection");
        }
        String apiKey = apiKey(credential);
        if (apiKey == null) {
            return fail(now, "The credential profile has no 'token' secret holding the API key");
        }
        HttpResponse<String> response;
        try {
            response = client.listDomains(apiKey);
        } catch (IOException e) {
            return fail(now, "Could not reach Resend: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return fail(now, "The Resend connection test was interrupted");
        }
        int status = response.statusCode();
        if (status >= 200 && status < 300) {
            return new ConnectionTestResponse(true, now, "Resend accepted the API key");
        }
        if (status == 401 && RESTRICTED_KEY.equals(client.errorName(response.body()))) {
            return new ConnectionTestResponse(true, now, "Resend accepted the API key (send-only key)");
        }
        return fail(now, "Resend returned HTTP " + status + "; check the API key");
    }

    private static String sender(IntegrationConnection connection) {
        Map<String, Object> metadata = connection.metadata();
        Object value = metadata == null ? null : metadata.get(ResendEmailSender.FROM);
        return value == null ? null : value.toString().trim();
    }

    private String apiKey(CredentialProfile credential) {
        try {
            Object value = secretCipher.decrypt(credential.encryptedSecretJson()).get(ResendEmailSender.TOKEN);
            return value == null || value.toString().isBlank() ? null : value.toString();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static ConnectionTestResponse fail(OffsetDateTime testedAt, String message) {
        return new ConnectionTestResponse(false, testedAt, message);
    }
}

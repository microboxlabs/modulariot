package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import com.microboxlabs.miot.integrations.vehicleimages.CarImagesClient;
import com.microboxlabs.miot.integrations.vehicleimages.CarImagesKeys;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Checks a CAR_IMAGES connection: the account key is in {@code metadata.apiKey}, the credential holds the secret,
 * and carimagesapi.com accepts both on {@code GET /api/v1/makes}.
 */
@ApplicationScoped
public class CarImagesConnectionTester implements ConnectionTester {

    private final CarImagesClient client;
    private final IntegrationSecretCipher secretCipher;

    @Inject
    public CarImagesConnectionTester(CarImagesClient client, IntegrationSecretCipher secretCipher) {
        this.client = client;
        this.secretCipher = secretCipher;
    }

    @Override
    public boolean supports(ProviderType providerType) {
        return providerType == ProviderType.CAR_IMAGES;
    }

    @Override
    public ConnectionTestResponse test(IntegrationConnection connection, CredentialProfile credential,
            ConnectionTestRequest request) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Object apiKey = connection.metadata() == null ? null : connection.metadata().get(CarImagesKeys.API_KEY);
        if (apiKey == null || apiKey.toString().isBlank()) {
            return fail(now, "metadata.apiKey must hold the account key (ci_...)");
        }
        if (!client.serves(connection.baseUrl())) {
            return fail(now, "The base URL must be " + client.baseUrl());
        }
        String secret = credential == null ? null : secret(credential);
        if (secret == null) {
            return fail(now, "The credential profile has no API secret");
        }
        try {
            int status = client.checkKey(apiKey.toString().trim(), secret);
            if (status >= 200 && status < 300) {
                return new ConnectionTestResponse(true, now, "carimagesapi.com accepted the key and secret");
            }
            return fail(now, "carimagesapi.com returned HTTP " + status + "; check the key and the secret");
        } catch (IOException e) {
            return fail(now, "Could not reach carimagesapi.com: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return fail(now, "The connection test was interrupted");
        }
    }

    private String secret(CredentialProfile credential) {
        try {
            Object value = secretCipher.decrypt(credential.encryptedSecretJson()).get(CarImagesKeys.SECRET);
            return value == null || value.toString().isBlank() ? null : value.toString();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static ConnectionTestResponse fail(OffsetDateTime now, String message) {
        return new ConnectionTestResponse(false, now, message);
    }
}

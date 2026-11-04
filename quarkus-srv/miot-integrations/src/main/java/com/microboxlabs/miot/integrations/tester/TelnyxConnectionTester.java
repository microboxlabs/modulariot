package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import com.microboxlabs.miot.integrations.telephony.PhoneNumbers;
import com.microboxlabs.miot.integrations.telephony.TelephonyKeys;
import com.microboxlabs.miot.integrations.telephony.TelnyxClient;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;

/**
 * Checks a TELNYX connection without placing a call: the caller number is E.164, the SIP
 * connection id is set, Telnyx accepts the API key on {@code GET /v2/balance}, and the key can
 * see the credential connection.
 */
@ApplicationScoped
public class TelnyxConnectionTester implements ConnectionTester {

    private final TelnyxClient client;
    private final IntegrationSecretCipher secretCipher;

    @Inject
    public TelnyxConnectionTester(TelnyxClient client, IntegrationSecretCipher secretCipher) {
        this.client = client;
        this.secretCipher = secretCipher;
    }

    @Override
    public boolean supports(ProviderType providerType) {
        return providerType == ProviderType.TELNYX;
    }

    @Override
    public ConnectionTestResponse test(IntegrationConnection connection, CredentialProfile credential,
            ConnectionTestRequest request) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (!client.serves(connection.baseUrl())) {
            return fail(now, "The base URL must be " + client.baseUrl());
        }
        if (PhoneNumbers.e164(metadata(connection, TelephonyKeys.CALLER_NUMBER)) == null) {
            return fail(now, "metadata.callerNumber must be an E.164 number, e.g. +56900000000");
        }
        String sipConnectionId = metadata(connection, TelephonyKeys.SIP_CONNECTION_ID);
        if (sipConnectionId == null) {
            return fail(now, "metadata.sipConnectionId must hold the Telnyx credential connection id");
        }
        if (credential == null) {
            return fail(now, "No credential profile is linked to this connection");
        }
        String apiKey = apiKey(credential);
        if (apiKey == null) {
            return fail(now, "The credential profile has no 'token' secret holding the API key");
        }
        try {
            HttpResponse<String> balance = client.balance(apiKey);
            if (balance.statusCode() == 401 || balance.statusCode() == 403) {
                return fail(now, "Telnyx rejected the API key (HTTP " + balance.statusCode() + ")");
            }
            if (!ok(balance)) {
                return fail(now, "Telnyx returned HTTP " + balance.statusCode() + " for /v2/balance");
            }
            HttpResponse<String> sip = client.credentialConnection(apiKey, sipConnectionId);
            if (sip.statusCode() == 404) {
                return fail(now, "Telnyx has no credential connection with id " + sipConnectionId);
            }
            if (!ok(sip)) {
                return fail(now, "Telnyx returned HTTP " + sip.statusCode() + " for the credential connection");
            }
            return new ConnectionTestResponse(true, now, "Telnyx accepted the API key and the SIP connection");
        } catch (IOException e) {
            return fail(now, "Could not reach Telnyx: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return fail(now, "The Telnyx connection test was interrupted");
        }
    }

    private static boolean ok(HttpResponse<String> response) {
        return response.statusCode() >= 200 && response.statusCode() < 300;
    }

    private String apiKey(CredentialProfile credential) {
        try {
            Object value = secretCipher.decrypt(credential.encryptedSecretJson()).get(TelephonyKeys.TOKEN);
            return value == null || value.toString().isBlank() ? null : value.toString().trim();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static String metadata(IntegrationConnection connection, String key) {
        Map<String, Object> metadata = connection.metadata();
        Object value = metadata == null ? null : metadata.get(key);
        return value == null || value.toString().isBlank() ? null : value.toString().trim();
    }

    private static ConnectionTestResponse fail(OffsetDateTime now, String message) {
        return new ConnectionTestResponse(false, now, message);
    }
}

package com.microboxlabs.miot.integrations.tester;

import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import com.microboxlabs.miot.integrations.telephony.GraphClient;
import com.microboxlabs.miot.integrations.telephony.PhoneNumbers;
import com.microboxlabs.miot.integrations.telephony.TeamsAppToken;
import com.microboxlabs.miot.integrations.telephony.TelephonyKeys;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;

/**
 * Checks a TEAMS_PHONE connection: Entra issues an app token for the credential, and Graph
 * answers the PSTN call list of the last hour, which needs CallRecords.Read.All.
 */
@ApplicationScoped
public class TeamsPhoneConnectionTester implements ConnectionTester {

    private final GraphClient graph;
    private final CredentialAuthRegistry auth;
    private final IntegrationSecretCipher secretCipher;

    @Inject
    public TeamsPhoneConnectionTester(GraphClient graph, CredentialAuthRegistry auth,
            IntegrationSecretCipher secretCipher) {
        this.graph = graph;
        this.auth = auth;
        this.secretCipher = secretCipher;
    }

    @Override
    public boolean supports(ProviderType providerType) {
        return providerType == ProviderType.TEAMS_PHONE;
    }

    @Override
    public ConnectionTestResponse test(IntegrationConnection connection, CredentialProfile credential,
            ConnectionTestRequest request) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (!graph.serves(connection.baseUrl())) {
            return fail(now, "The base URL must be " + graph.baseUrl());
        }
        Object callerId = connection.metadata() == null ? null
                : connection.metadata().get(TelephonyKeys.DEFAULT_CALLER_ID);
        if (callerId != null && !callerId.toString().isBlank() && PhoneNumbers.e164(callerId) == null) {
            return fail(now, "metadata.defaultCallerId must be an E.164 number, e.g. +56900000000");
        }
        if (credential == null) {
            return fail(now, "No credential profile is linked to this connection");
        }
        Optional<String> problem = TeamsAppToken.problem(credential.credentialType(), credential.publicConfig());
        if (problem.isPresent()) {
            return fail(now, problem.get());
        }
        Map<String, Object> secret;
        try {
            secret = secretCipher.decrypt(credential.encryptedSecretJson());
        } catch (RuntimeException e) {
            return fail(now, "Could not read the client secret from the credential profile");
        }
        Map<String, String> headers;
        try {
            headers = TeamsAppToken.headers(auth, new CredentialAuthContext(credential.authType(),
                    credential.credentialType(), credential.publicConfig(), secret));
        } catch (AuthResolutionException | IllegalArgumentException e) {
            return fail(now, "Microsoft Entra did not issue a token: " + e.getMessage());
        }
        Instant to = Instant.now();
        try {
            HttpResponse<String> response = graph.pstnCalls(headers, to.minus(Duration.ofHours(1)), to);
            int status = response.statusCode();
            if (status >= 200 && status < 300) {
                return new ConnectionTestResponse(true, now, "Entra issued a token and Graph returned the PSTN calls");
            }
            if (status == 401 || status == 403) {
                return fail(now, "Graph returned HTTP " + status
                        + ": grant the app CallRecords.Read.All (application) with admin consent");
            }
            return fail(now, "Graph returned HTTP " + status + " for the PSTN call list");
        } catch (IOException e) {
            return fail(now, "Could not reach Microsoft Graph: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return fail(now, "The Teams connection test was interrupted");
        }
    }

    private static ConnectionTestResponse fail(OffsetDateTime now, String message) {
        return new ConnectionTestResponse(false, now, message);
    }
}

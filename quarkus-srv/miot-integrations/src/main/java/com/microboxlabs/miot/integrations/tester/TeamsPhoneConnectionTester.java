package com.microboxlabs.miot.integrations.tester;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.auth.oauth.OAuth2CredentialConfigs;
import com.microboxlabs.miot.integrations.net.OutboundUrlGuard;
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
import java.net.URI;
import java.util.function.Consumer;

/**
 * Checks a TEAMS_PHONE connection: Entra issues an app token for the credential, and Graph answers both call
 * reports of the last hour, PSTN (Calling Plans, Operator Connect) and Direct Routing, which need
 * CallRecords.Read.All. The message says how many calls each report returned, so an organization can see which
 * one holds its calls.
 */
@ApplicationScoped
public class TeamsPhoneConnectionTester implements ConnectionTester {

    private final GraphClient graph;
    private final CredentialAuthRegistry auth;
    private final IntegrationSecretCipher secretCipher;
    private final Consumer<URI> tokenUrlGuard;
    private final ObjectMapper json = new ObjectMapper();

    @Inject
    public TeamsPhoneConnectionTester(GraphClient graph, CredentialAuthRegistry auth,
            IntegrationSecretCipher secretCipher) {
        this(graph, auth, secretCipher, url -> OutboundUrlGuard.requirePublicHttpUrl(url, "tokenUrl"));
    }

    TeamsPhoneConnectionTester(GraphClient graph, CredentialAuthRegistry auth,
            IntegrationSecretCipher secretCipher, Consumer<URI> tokenUrlGuard) {
        this.graph = graph;
        this.auth = auth;
        this.secretCipher = secretCipher;
        this.tokenUrlGuard = tokenUrlGuard;
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
        try {
            tokenUrlGuard.accept(OAuth2CredentialConfigs.tokenUrl(credential.credentialType(), credential.publicConfig()));
        } catch (IllegalArgumentException e) {
            return fail(now, e.getMessage());
        }
        Map<String, Object> secret;
        try {
            secret = secretCipher.decrypt(credential.encryptedSecretJson());
        } catch (RuntimeException e) {
            return fail(now, "Could not read the client secret from the credential profile");
        }
        Map<String, String> headers;
        try {
            headers = TeamsAppToken.headers(auth, new CredentialAuthContext(AuthType.OAUTH2_CLIENT_CREDENTIALS,
                    credential.credentialType(), credential.publicConfig(), secret));
        } catch (AuthResolutionException | IllegalArgumentException e) {
            return fail(now, "Microsoft Entra did not issue a token: " + e.getMessage());
        }
        Instant to = Instant.now();
        Instant from = to.minus(Duration.ofHours(1));
        try {
            Report pstn = report(graph.pstnCalls(headers, from, to), "PSTN");
            if (pstn.failure() != null) {
                return fail(now, pstn.failure());
            }
            Report directRouting = report(graph.directRoutingCalls(headers, from, to), "Direct Routing");
            if (directRouting.failure() != null) {
                return fail(now, directRouting.failure());
            }
            return new ConnectionTestResponse(true, now, "Entra issued a token and Graph returned the call records"
                    + " of the last hour (PSTN: " + pstn.count() + ", Direct Routing: " + directRouting.count() + ")");
        } catch (IOException e) {
            return fail(now, "Could not reach Microsoft Graph: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return fail(now, "The Teams connection test was interrupted");
        }
    }

    /** {@code count}: rows of the first page, with a {@code +} when Graph has more pages. */
    private record Report(String count, String failure) {
    }

    private Report report(HttpResponse<String> response, String name) {
        int status = response.statusCode();
        if (status == 404) {
            return new Report("0", null);
        }
        if (status == 401 || status == 403) {
            return new Report(null, "Graph returned HTTP " + status + " for the " + name
                    + " calls: grant the app CallRecords.Read.All (application) with admin consent");
        }
        if (status < 200 || status >= 300) {
            return new Report(null, "Graph returned HTTP " + status + " for the " + name + " call list");
        }
        try {
            JsonNode body = json.readTree(response.body() == null ? "{}" : response.body());
            if (body == null || !body.path("value").isArray()) {
                return new Report(null, "Graph returned an invalid " + name + " call list");
            }
            boolean more = !body.path("@odata.nextLink").asText("").isBlank();
            return new Report(body.path("value").size() + (more ? "+" : ""), null);
        } catch (IOException e) {
            return new Report(null, "Graph returned a " + name + " call list that is not JSON");
        }
    }

    private static ConnectionTestResponse fail(OffsetDateTime now, String message) {
        return new ConnectionTestResponse(false, now, message);
    }
}

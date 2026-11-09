package com.microboxlabs.miot.integrations.tester;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import com.microboxlabs.miot.integrations.telephony.GraphClient;
import com.microboxlabs.miot.integrations.telephony.StubHttp;
import com.microboxlabs.miot.integrations.telephony.TeamsAppToken;
import java.net.URI;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TeamsPhoneConnectionTesterTest {

    private static final URI GRAPH = URI.create("https://graph.test");
    private static final Map<String, Object> ENTRA = Map.of("tenantId", "00000000-0000-0000-0000-000000000000",
            "clientId", "client-1", "scope", TeamsAppToken.GRAPH_SCOPE);

    private final IntegrationSecretCipher cipher = new IntegrationSecretCipher(new ObjectMapper(), "unit-test-key");
    private final StubHttp http = new StubHttp();
    private boolean entraRefuses;
    private CredentialAuthContext received;
    private URI checkedUrl;

    private final CredentialAuthRegistry registry = new CredentialAuthRegistry(List.of(new CredentialAuthProvider() {
        @Override
        public Set<AuthType> supportedTypes() {
            return Set.of(AuthType.OAUTH2_CLIENT_CREDENTIALS);
        }

        @Override
        public ResolvedAuth resolve(CredentialAuthContext context) {
            received = context;
            if (entraRefuses) {
                throw new AuthResolutionException("OAuth token request failed with HTTP 401 (invalid_client)");
            }
            return ResolvedAuth.headers(Map.of("Authorization", "Bearer app-token"), Instant.now().plusSeconds(60));
        }
    }));

    private final TeamsPhoneConnectionTester tester =
            new TeamsPhoneConnectionTester(new GraphClient(http, GRAPH), registry, cipher, url -> checkedUrl = url);

    @Test
    void aTokenAndTheCallRecordsPermissionPass() {
        http.reply("/v1.0/communications/callRecords/getPstnCalls", 200, "{\"value\":[]}");

        ConnectionTestResponse response = tester.test(connection(Map.of()), credential(ENTRA), null);

        assertTrue(response.success(), response.message());
        assertEquals("Bearer app-token", http.last().header("Authorization"));
        String call = http.last().request().uri().getPath();
        String fromMarker = "fromDateTime=";
        String toMarker = ",toDateTime=";
        int fromStart = call.indexOf(fromMarker) + fromMarker.length();
        int separator = call.indexOf(toMarker, fromStart);
        Instant from = Instant.parse(call.substring(fromStart, separator));
        Instant to = Instant.parse(call.substring(separator + toMarker.length(), call.length() - 1));
        assertEquals(java.time.Duration.ofHours(1), java.time.Duration.between(from, to));
        assertEquals(AuthType.OAUTH2_CLIENT_CREDENTIALS, received.authType());
        assertEquals(CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, received.credentialType());
        assertEquals(ENTRA, received.publicConfig());
        assertEquals(Map.of("clientSecret", "placeholder-secret"), received.secret());
        assertEquals("https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/oauth2/v2.0/token",
                checkedUrl.toString());
    }

    @Test
    void saysHowManyCallsEachReportReturned() {
        http.reply("/v1.0/communications/callRecords/getPstnCalls", 200, "{\"value\":[]}")
                .reply("/v1.0/communications/callRecords/getDirectRoutingCalls", 200,
                        "{\"value\":[{\"id\":\"d1\"},{\"id\":\"d2\"}]}");

        ConnectionTestResponse response = tester.test(connection(Map.of()), credential(ENTRA), null);

        assertTrue(response.success(), response.message());
        assertTrue(response.message().contains("PSTN: 0, Direct Routing: 2"), response.message());
        assertEquals(2, http.seen().size());
    }

    @Test
    void aReportWithMorePagesShowsAPlusAndNotYetPublishedCountsAsNone() {
        http.reply("/v1.0/communications/callRecords/getPstnCalls", 404, "{}")
                .reply("/v1.0/communications/callRecords/getDirectRoutingCalls", 200,
                        "{\"value\":[{\"id\":\"d1\"}],\"@odata.nextLink\":\"https://graph.test/next\"}");

        ConnectionTestResponse response = tester.test(connection(Map.of()), credential(ENTRA), null);

        assertTrue(response.success(), response.message());
        assertTrue(response.message().contains("PSTN: 0, Direct Routing: 1+"), response.message());
    }

    @Test
    void aRefusedDirectRoutingReportFails() {
        http.reply("/v1.0/communications/callRecords/getPstnCalls", 200, "{\"value\":[]}")
                .reply("/v1.0/communications/callRecords/getDirectRoutingCalls", 403, "{}");

        ConnectionTestResponse response = tester.test(connection(Map.of()), credential(ENTRA), null);

        assertFalse(response.success());
        assertTrue(response.message().contains("Direct Routing"), response.message());
        assertTrue(response.message().contains("CallRecords.Read.All"), response.message());
    }

    @Test
    void aMissingPermissionSaysWhichOne() {
        http.reply("/v1.0/communications/callRecords/getPstnCalls", 403, "{\"error\":{}}");

        ConnectionTestResponse response = tester.test(connection(Map.of()), credential(ENTRA), null);

        assertFalse(response.success());
        assertTrue(response.message().contains("CallRecords.Read.All"), response.message());
    }

    @Test
    void aRefusedSecretFailsBeforeGraph() {
        entraRefuses = true;

        ConnectionTestResponse response = tester.test(connection(Map.of()), credential(ENTRA), null);

        assertFalse(response.success());
        assertTrue(response.message().contains("Entra"), response.message());
        assertTrue(http.seen().isEmpty());
    }

    @Test
    void theCredentialMustBeAnEntraAppForGraph() {
        assertFalse(tester.test(connection(Map.of()), null, null).success());
        Map<String, Object> otherScope = Map.of("tenantId", "t", "clientId", "c", "scope", "api://other/.default");
        assertFalse(tester.test(connection(Map.of()), credential(otherScope), null).success());
        assertFalse(tester.test(connection(Map.of("defaultCallerId", "not a number")), credential(ENTRA), null)
                .success());
        assertTrue(http.seen().isEmpty());
    }

    @Test
    void usesTheEntraClientGrantEvenForAnInconsistentStoredAuthType() {
        http.reply("/v1.0/communications/callRecords/getPstnCalls", 200, "{\"value\":[]}");
        assertTrue(tester.test(connection(Map.of()), credential(ENTRA, AuthType.BEARER_TOKEN), null).success());
        assertEquals(AuthType.OAUTH2_CLIENT_CREDENTIALS, received.authType());
    }

    @Test
    void rejectsPrivateTokenEndpointsBeforeResolvingAuthOrCallingGraph() {
        var config = new java.util.LinkedHashMap<>(ENTRA);
        config.put("tokenUrlOverride", "http://127.0.0.1:6553/token");
        var guarded = new TeamsPhoneConnectionTester(new GraphClient(http, GRAPH), registry, cipher);
        ConnectionTestResponse response = guarded.test(connection(Map.of()), credential(config), null);
        assertFalse(response.success());
        assertTrue(response.message().contains("tokenUrl"), response.message());
        org.junit.jupiter.api.Assertions.assertNull(received);
        assertTrue(http.seen().isEmpty());
    }

    private static IntegrationConnection connection(Map<String, Object> metadata) {
        return new IntegrationConnection("conn-1", "tenant", "Teams", ProviderType.TEAMS_PHONE, GRAPH, "cred-1",
                ConnectionStatus.DRAFT, null, null, metadata);
    }

    private CredentialProfile credential(Map<String, Object> publicConfig) {
        return credential(publicConfig, AuthType.OAUTH2_CLIENT_CREDENTIALS);
    }

    private CredentialProfile credential(Map<String, Object> publicConfig, AuthType authType) {
        OffsetDateTime now = OffsetDateTime.now();
        return new CredentialProfile("cred-1", "tenant", "Teams", CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS,
                authType, "PRODUCTION", publicConfig,
                cipher.encrypt(Map.of("clientSecret", "placeholder-secret")), "****", 1, null, null, now, now, null,
                null);
    }
}

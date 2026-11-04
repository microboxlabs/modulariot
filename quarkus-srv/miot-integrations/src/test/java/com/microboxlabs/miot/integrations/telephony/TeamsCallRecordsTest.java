package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.telephony.PstnCall;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TeamsCallRecordsTest {

    @Test
    void refusesAnIncompleteScanWithoutFetchingADiscardedPage() {
        String page = "{\"value\":[],\"@odata.nextLink\":\"https://graph.test/next\"}";
        http.reply(PATH, 200, page).reply("/next", 200, page);
        assertThrows(TelephonyUnavailableException.class,
                () -> records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));
        assertEquals(TeamsCallRecords.MAX_PAGES, http.seen().size());
    }

    @Test
    void anUnreadableListCannotBeTreatedAsNoCalls() {
        http.reply(PATH, 200, "null");
        assertThrows(TelephonyUnavailableException.class,
                () -> records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));
    }

    private static final URI GRAPH = URI.create("https://graph.test");
    private static final String PATH = "/v1.0/communications/callRecords/getPstnCalls";
    private static final Instant FROM = Instant.parse("2026-11-04T10:00:00Z");

    private final StubHttp http = new StubHttp();
    private IntegrationConnection stored = connection(ConnectionStatus.ACTIVE);
    private AuthType storedAuth = AuthType.OAUTH2_CLIENT_CREDENTIALS;
    private CredentialAuthContext received;
    private Map<String, Object> publicConfig = Map.of("scope", TeamsAppToken.GRAPH_SCOPE,
            "tenantId", "00000000-0000-0000-0000-000000000000", "clientId", "client-1");

    private final CredentialAuthRegistry registry = new CredentialAuthRegistry(List.of(new CredentialAuthProvider() {
        @Override
        public Set<AuthType> supportedTypes() {
            return Set.of(AuthType.OAUTH2_CLIENT_CREDENTIALS);
        }

        @Override
        public ResolvedAuth resolve(CredentialAuthContext context) {
            received = context;
            return ResolvedAuth.headers(Map.of("Authorization", "Bearer app-token"), Instant.MAX);
        }
    }));

    private final TeamsCallRecords records = new TeamsCallRecords(
            (tenant, id) -> stored,
            (tenant, c) -> resolve(c),
            registry, new GraphClient(http, GRAPH), new ObjectMapper(), url -> {
                // Normal tests use a fake auth provider and do not resolve external DNS.
            });

    private ResolvedConnection resolve(IntegrationConnection c) {
        return new ResolvedConnection(c.id(), c.baseUrl(), c.metadata(), Map.of("clientSecret", "x"),
                storedAuth, CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS, publicConfig);
    }

    @Test
    void rejectsPrivateTokenEndpointsBeforeResolvingAuthOrFetchingCallRecords() {
        publicConfig = new java.util.LinkedHashMap<>(publicConfig);
        publicConfig.put("tokenUrlOverride", "http://127.0.0.1:6553/token");
        var guarded = new TeamsCallRecords((tenant, id) -> stored, (tenant, c) -> resolve(c),
                registry, new GraphClient(http, GRAPH), new ObjectMapper());
        var failure = assertThrows(TelephonyUnavailableException.class,
                () -> guarded.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));
        assertTrue(failure.getMessage().contains("tokenUrl"), failure.getMessage());
        org.junit.jupiter.api.Assertions.assertNull(received);
        assertTrue(http.seen().isEmpty());
    }

    @Test
    void alwaysUsesTheEntraClientGrantForGraphRecords() {
        storedAuth = AuthType.BEARER_TOKEN;
        http.reply(PATH, 200, "{\"value\":[]}");
        assertTrue(records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)).isEmpty());
        assertEquals(AuthType.OAUTH2_CLIENT_CREDENTIALS, received.authType());
        assertEquals(publicConfig, received.publicConfig());
        assertEquals(Map.of("clientSecret", "x"), received.secret());
    }

    @Test
    void refusesAnEntraCredentialWithTheWrongGraphScopeBeforeAuthResolution() {
        publicConfig = Map.of("scope", "api://other/.default");
        assertThrows(TelephonyUnavailableException.class,
                () -> records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));
        org.junit.jupiter.api.Assertions.assertNull(received);
        assertTrue(http.seen().isEmpty());
    }

    @Test
    void readsTheRowsOfEveryPage() {
        http.reply("/next", 200, "{\"value\":[" + row("r2", "+56922222222", 0) + "]}")
                .reply(PATH, 200, "{\"value\":[" + row("r1", "+56 9 1111 1111", 42) + "],"
                        + "\"@odata.nextLink\":\"https://graph.test/next?page=2\"}");

        List<PstnCall> calls = records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600));

        assertEquals(2, calls.size());
        PstnCall first = calls.get(0);
        assertEquals("ana@example.com", first.userPrincipalName());
        assertEquals("+56911111111", first.calleeNumber());
        assertEquals(42, first.durationSeconds());
        assertEquals(Instant.parse("2026-11-04T10:01:00Z"), first.start());
        assertEquals("Bearer app-token", http.last().header("Authorization"));
        assertTrue(http.seen().get(0).request().uri().toString()
                .contains("fromDateTime=2026-11-04T10:00:00Z,toDateTime=2026-11-04T10:10:00Z"));
    }

    @Test
    void notThereYetIsAnEmptyList() {
        http.reply(PATH, 404, "{\"error\":{}}");
        assertEquals(List.of(), records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));
    }

    @Test
    void aMissingPermissionIsReported() {
        http.reply(PATH, 403, "{}");
        TelephonyUnavailableException e = assertThrows(TelephonyUnavailableException.class,
                () -> records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));
        assertTrue(e.getMessage().contains("CallRecords.Read.All"));
    }

    @Test
    void aNextLinkOnAnotherHostIsNotFollowed() {
        http.reply(PATH, 200, "{\"value\":[],\"@odata.nextLink\":\"https://elsewhere.test/next\"}");
        assertThrows(IllegalArgumentException.class,
                () -> records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));
        assertEquals(1, http.seen().size());
    }

    @Test
    void onlyAReadyTeamsConnectionIsRead() {
        stored = connection(ConnectionStatus.DRAFT);
        assertThrows(TelephonyUnavailableException.class,
                () -> records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));
        assertTrue(http.seen().isEmpty());
    }

    private static String row(String id, String callee, int duration) {
        return "{\"id\":\"" + id + "\",\"callId\":\"c-" + id + "\",\"userPrincipalName\":\"ana@example.com\","
                + "\"callerNumber\":\"+56900000000\",\"calleeNumber\":\"" + callee + "\","
                + "\"startDateTime\":\"2026-11-04T10:01:00Z\",\"endDateTime\":\"2026-11-04T10:01:42Z\","
                + "\"duration\":" + duration + ",\"callType\":\"user_out\"}";
    }

    private static IntegrationConnection connection(ConnectionStatus status) {
        return new IntegrationConnection("conn-1", "acme", "Teams", ProviderType.TEAMS_PHONE, GRAPH, "cred", status,
                null, null, Map.of());
    }
}

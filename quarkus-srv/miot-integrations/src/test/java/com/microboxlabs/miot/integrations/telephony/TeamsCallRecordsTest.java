package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.telephony.CallRecordsPageLimitException;
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
        assertThrows(CallRecordsPageLimitException.class,
                () -> records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));
        assertEquals(TeamsCallRecords.MAX_PAGES, http.seen().size());
    }

    @Test
    void anUnreadableListCannotBeTreatedAsNoCalls() {
        http.reply(PATH, 200, "null");
        assertThrows(TelephonyUnavailableException.class,
                () -> records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));
    }

    @Test
    void readsBothReportsAndMapsDirectRoutingRows() {
        http.reply(PATH, 200, "{\"value\":[" + row("p1", "+12025550101", 42) + "]}")
                .reply(DR_PATH, 200, "{\"value\":[" + directRoutingRow("d1", "ByotOut", true,
                        "\"endDateTime\":\"2026-11-04T10:02:05Z\"", 80) + ","
                        + directRoutingRow("d2", "ByotIn", false, "\"failureDateTime\":\"2026-11-04T10:01:20Z\"", 15)
                        + "]}");

        List<PstnCall> calls = records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600));

        assertEquals(List.of("p1", "d1", "d2"), calls.stream().map(PstnCall::id).toList());
        PstnCall pstn = calls.get(0);
        assertEquals(PstnCall.Report.PSTN, pstn.report());
        assertTrue(pstn.outbound());
        PstnCall answered = calls.get(1);
        assertEquals(PstnCall.Report.DIRECT_ROUTING, answered.report());
        assertEquals("corr-d1", answered.callId());
        assertEquals("operator1@example.test", answered.userPrincipalName());
        assertEquals("+12025550100", answered.callerNumber());
        assertEquals("+12025550101", answered.calleeNumber());
        assertEquals(Instant.parse("2026-11-04T10:01:05Z"), answered.start());
        assertEquals(Instant.parse("2026-11-04T10:02:05Z"), answered.end());
        assertEquals(60, answered.durationSeconds(), "answer to end, not the ringing from the invite");
        assertEquals(Boolean.TRUE, answered.answered());
        assertTrue(answered.outbound());
        PstnCall failed = calls.get(2);
        assertEquals(0, failed.durationSeconds());
        assertEquals(Boolean.FALSE, failed.answered());
        assertEquals(Instant.parse("2026-11-04T10:01:20Z"), failed.end());
        assertFalse(failed.outbound());
        assertTrue(http.seen().get(1).request().uri().toString().contains(
                "/getDirectRoutingCalls(fromDateTime=2026-11-04T10:00:00Z,toDateTime=2026-11-04T10:10:00Z)"));
        assertEquals("Bearer app-token", http.seen().get(1).header("Authorization"));
    }

    @Test
    void directRoutingPagesAreFollowed() {
        http.reply(PATH, 404, "{}")
                .reply("/dr-next", 200, "{\"value\":[" + directRoutingRow("d2", "ByotOut", true,
                        "\"endDateTime\":\"2026-11-04T10:02:05Z\"", 80) + "]}")
                .reply(DR_PATH, 200, "{\"value\":[" + directRoutingRow("d1", "ByotOut", true,
                        "\"endDateTime\":\"2026-11-04T10:02:05Z\"", 80) + "],"
                        + "\"@odata.nextLink\":\"https://graph.test/dr-next\"}");

        assertEquals(List.of("d1", "d2"),
                records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)).stream().map(PstnCall::id).toList());
    }

    @Test
    void aFailedCallWithoutAnAnswerTimestampUsesItsInviteForMatching() {
        http.reply(PATH, 404, "{}").reply(DR_PATH, 200, """
                {"value":[{"id":"failed","correlationId":"corr-failed","callType":"ByotOut",
                  "userPrincipalName":"operator1@example.test","callerNumber":"+12025550100",
                  "calleeNumber":"+12025550101","successfulCall":false,"duration":15,
                  "inviteDateTime":"2026-11-04T10:00:45Z","failureDateTime":"2026-11-04T10:01:00Z"}]}
                """);

        PstnCall failed = records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)).getFirst();

        assertEquals(Instant.parse("2026-11-04T10:00:45Z"), failed.start());
        assertEquals(Instant.parse("2026-11-04T10:01:00Z"), failed.end());
        assertEquals(0, failed.durationSeconds());
        assertEquals(Boolean.FALSE, failed.answered());
        assertFalse(failed.connected());
    }

    @Test
    void aMissingLaterPageCannotMakeAPartialReportAuthoritative() {
        http.reply(PATH, 404, "{}")
                .reply(DR_PATH, 200, "{\"value\":[" + directRoutingRow("d1", "ByotOut", true,
                        "\"endDateTime\":\"2026-11-04T10:02:05Z\"", 80) + "],"
                        + "\"@odata.nextLink\":\"https://graph.test/missing\"}");

        TelephonyUnavailableException failure = assertThrows(TelephonyUnavailableException.class,
                () -> records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));

        assertTrue(failure.getMessage().contains("complete call list"));
    }

    @Test
    void aRefusedDirectRoutingReportFailsTheLookup() {
        http.reply(PATH, 200, "{\"value\":[" + row("p1", "+12025550101", 42) + "]}").reply(DR_PATH, 403, "{}");
        TelephonyUnavailableException e = assertThrows(TelephonyUnavailableException.class,
                () -> records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600)));
        assertTrue(e.getMessage().contains("CallRecords.Read.All"));
    }

    @Test
    void directRoutingOutboundTypes() {
        for (String type : List.of("ByotOut", "ByotOutUserForwarding", "ByotOutUserTransfer", "ByotOutUserConf",
                "dr_out")) {
            assertTrue(drType(type).outbound(), type);
        }
        for (String type : List.of("ByotIn", "dr_in", "dr_in_bot")) {
            assertFalse(drType(type).outbound(), type);
        }
        assertFalse(drType(null).outbound());
    }

    private static PstnCall drType(String type) {
        return new PstnCall("d", "c", "operator1@example.test", null, null, FROM, FROM, 0, type, true,
                PstnCall.Report.DIRECT_ROUTING);
    }

    private static String directRoutingRow(String id, String type, boolean success, String endField, int duration) {
        return "{\"id\":\"" + id + "\",\"correlationId\":\"corr-" + id + "\","
                + "\"userPrincipalName\":\"operator1@example.test\",\"callerNumber\":\"+12025550100\","
                + "\"calleeNumber\":\"+1 (202) 555-0101\",\"inviteDateTime\":\"2026-11-04T10:00:45Z\","
                + "\"startDateTime\":\"2026-11-04T10:01:05Z\"," + endField + ",\"duration\":" + duration
                + ",\"successfulCall\":" + success + ",\"callType\":\"" + type + "\"}";
    }

    private static final String DR_PATH = "/v1.0/communications/callRecords/getDirectRoutingCalls";
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
        http.reply("/next", 200, "{\"value\":[" + row("r2", "+12025550102", 0) + "]}")
                .reply(PATH, 200, "{\"value\":[" + row("r1", "+1 (202) 555-0101", 42) + "],"
                        + "\"@odata.nextLink\":\"https://graph.test/next?page=2\"}");

        List<PstnCall> calls = records.pstnCalls("acme", "conn-1", FROM, FROM.plusSeconds(600));

        assertEquals(2, calls.size());
        PstnCall first = calls.get(0);
        assertEquals("operator1@example.test", first.userPrincipalName());
        assertEquals("+12025550101", first.calleeNumber());
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
        return "{\"id\":\"" + id + "\",\"callId\":\"c-" + id + "\",\"userPrincipalName\":\"operator1@example.test\","
                + "\"callerNumber\":\"+12025550100\",\"calleeNumber\":\"" + callee + "\","
                + "\"startDateTime\":\"2026-11-04T10:01:00Z\",\"endDateTime\":\"2026-11-04T10:01:42Z\","
                + "\"duration\":" + duration + ",\"callType\":\"user_out\"}";
    }

    private static IntegrationConnection connection(ConnectionStatus status) {
        return new IntegrationConnection("conn-1", "acme", "Teams", ProviderType.TEAMS_PHONE, GRAPH, "cred", status,
                null, null, Map.of());
    }
}

package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.core.telephony.WebRtcToken;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TelnyxWebRtcTokensTest {

    @Test
    void doesNotReuseAnotherOperatorsCredentialEvenIfTheProviderFilterReturnsIt() {
        http.reply("POST /v2/telephony_credentials/new-1/token", 201, "new-token")
                .reply("GET /v2/telephony_credentials", 200,
                "{\"data\":[{\"id\":\"other-operator\",\"name\":\"someone-else\",\"resource_id\":\"connection:sip-1\"}]}")
                .reply("POST /v2/telephony_credentials", 201, "{\"data\":{\"id\":\"new-1\"}}");
        assertEquals("new-token", tokens.issue("acme", "conn-1", "ana@example.com").token());
        assertTrue(http.seen().stream().noneMatch(r -> r.path().contains("other-operator")));
    }

    private static final URI API = URI.create("https://api.telnyx.test");
    private static final Instant NOW = Instant.parse("2026-11-04T10:00:00Z");
    private static final Map<String, Object> METADATA = Map.of("sipConnectionId", "sip-1",
            "callerNumber", "+56 9 0000 0000");

    private final StubHttp http = new StubHttp();
    private IntegrationConnection stored = connection(ProviderType.TELNYX, ConnectionStatus.ACTIVE);

    private final TelnyxWebRtcTokens tokens = new TelnyxWebRtcTokens(
            (tenant, id) -> stored != null && stored.id().equals(id) ? stored : null,
            (tenant, c) -> new ResolvedConnection(c.id(), c.baseUrl(), c.metadata(), Map.of("token", "KEY_test")),
            new TelnyxClient(http, API), new ObjectMapper(), Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void reusesTheOperatorsCredentialAndReturnsAToken() {
        String name = TelnyxWebRtcTokens.credentialName("acme", "ana@example.com");
        http.reply("POST /v2/telephony_credentials/cred-1/token", 201, "eyJ.placeholder.jwt")
                .reply("GET /v2/telephony_credentials", 200,
                        "{\"data\":[{\"id\":\"old\",\"resource_id\":\"connection:sip-1\",\"expired\":true},"
                                + "{\"id\":\"other\",\"resource_id\":\"connection:sip-2\",\"expired\":false},"
                                + "{\"id\":\"cred-1\",\"resource_id\":\"connection:sip-1\",\"expired\":false,"
                                + "\"name\":\""
                                + name + "\"}]}");

        WebRtcToken token = tokens.issue("acme", "conn-1", "Ana@example.com");

        assertEquals("eyJ.placeholder.jwt", token.token());
        assertEquals("+56900000000", token.callerNumber());
        assertEquals(NOW.plusSeconds(24 * 3600), token.expiresAt());
        assertTrue(http.seen().get(0).request().uri().getRawQuery().contains(name));
        assertEquals("Bearer KEY_test", http.last().header("Authorization"));
        assertEquals(2, http.seen().size(), "no credential is created when one exists");
        assertTrue(!token.toString().contains("eyJ"), "the token stays out of logs");
    }

    @Test
    void createsTheCredentialOnFirstUse() {
        http.reply("POST /v2/telephony_credentials/new-1/token", 201, "\"eyJ.quoted\"")
                .reply("GET /v2/telephony_credentials", 200, "{\"data\":[]}")
                .reply("POST /v2/telephony_credentials", 201, "{\"data\":{\"id\":\"new-1\"}}");

        assertEquals("eyJ.quoted", tokens.issue("acme", "conn-1", "ana@example.com").token());
        StubHttp.Seen create = http.seen().get(1);
        assertEquals("POST", create.request().method());
        assertTrue(create.body().contains("\"connection_id\":\"sip-1\""), create.body());
        assertTrue(!create.body().contains("ana@example.com"), "the email is not sent to Telnyx");
    }

    @Test
    void theNameDependsOnTheOrganizationAndTheOperator() {
        String a = TelnyxWebRtcTokens.credentialName("acme", "ana@example.com");
        assertEquals(a, TelnyxWebRtcTokens.credentialName("acme", " ANA@example.com "));
        assertTrue(!a.equals(TelnyxWebRtcTokens.credentialName("other", "ana@example.com")));
        assertTrue(a.startsWith("miot-op-") && a.length() == 40);
    }

    @Test
    void refusesWhatIsNotAReadyTelnyxConnection() {
        stored = connection(ProviderType.TEAMS_PHONE, ConnectionStatus.ACTIVE);
        assertThrows(TelephonyUnavailableException.class, () -> tokens.issue("acme", "conn-1", "ana@example.com"));
        stored = connection(ProviderType.TELNYX, ConnectionStatus.TEST_FAILED);
        assertThrows(TelephonyUnavailableException.class, () -> tokens.issue("acme", "conn-1", "ana@example.com"));
        stored = null;
        assertThrows(TelephonyUnavailableException.class, () -> tokens.issue("acme", "conn-1", "ana@example.com"));
        assertTrue(http.seen().isEmpty());
    }

    @Test
    void aRejectedKeyIsReported() {
        http.reply("GET /v2/telephony_credentials", 401, "{}");
        TelephonyUnavailableException e = assertThrows(TelephonyUnavailableException.class,
                () -> tokens.issue("acme", "conn-1", "ana@example.com"));
        assertTrue(e.getMessage().contains("rejected"));
    }

    private static IntegrationConnection connection(ProviderType type, ConnectionStatus status) {
        return new IntegrationConnection("conn-1", "acme", "Telnyx", type, API, "cred", status, null, null, METADATA);
    }
}

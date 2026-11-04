package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.core.telephony.TelephonyLine;
import com.microboxlabs.miot.core.telephony.TelephonyProvider;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.core.telephony.WebRtcToken;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Plan;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IntegrationsTelephonyTest {

    private static final URI API = URI.create("https://api.telnyx.test");
    private static final Instant NOW = Instant.parse("2026-11-04T10:00:00Z");

    private final Map<String, IntegrationConnection> byKey = new HashMap<>();
    private final StubHttp http = new StubHttp()
            .reply("GET /v2/telephony_credentials", 200, "{\"data\":[]}")
            .reply("POST /v2/telephony_credentials/new-1/token", 201, "eyJ.placeholder")
            .reply("POST /v2/telephony_credentials", 201,
                    "{\"data\":{\"id\":\"new-1\",\"sip_username\":\"gencred-acme-1\"}}");
    private final InMemoryTelephonyUsageStore usage = new InMemoryTelephonyUsageStore();
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final TelnyxWebRtcTokens tokens = new TelnyxWebRtcTokens(
            (tenant, id) -> byKey.values().stream().filter(c -> c.tenantCode().equals(tenant) && c.id().equals(id))
                    .findFirst().orElse(null),
            (tenant, c) -> new ResolvedConnection(c.id(), c.baseUrl(), c.metadata(), Map.of("token", "KEY_test")),
            new TelnyxClient(http, API), new ObjectMapper(), clock, "https://miot.test");
    private final IntegrationsTelephony telephony = new IntegrationsTelephony(
            (tenant, provider) -> byKey.get(tenant + "|" + provider), tokens, null, usage,
            new TelephonyPlanService(usage, clock), clock);

    private void store(IntegrationConnection c) {
        byKey.put(c.tenantCode() + "|" + c.providerType(), c);
        http.reply("GET /v2/credential_connections", 200, TelnyxWebRtcTokensTest.parked(c.id()));
    }

    @Test
    void listsTheOrganizationsOwnLines() {
        store(telnyx("t1", "acme", Map.of("callerNumber", "+56 9 0000 0000")));
        store(new IntegrationConnection("m1", "acme", "Teams", ProviderType.TEAMS_PHONE, null, "cred",
                ConnectionStatus.TEST_FAILED, null, null, Map.of()));
        store(telnyx("p1", PlatformScope.TENANT, Map.of("callerNumber", "+56 2 0000 0000")));

        List<TelephonyLine> lines = telephony.lines("acme");

        assertEquals(new TelephonyLine("t1", TelephonyProvider.TELNYX, "Line t1", "+56900000000", true, false),
                lines.get(0));
        assertEquals(TelephonyProvider.TEAMS_PHONE, lines.get(1).provider());
        assertFalse(lines.get(1).ready());
        assertNull(lines.get(1).callerNumber());
    }

    @Test
    void anOrganizationCannotSeeAnotherOrganizationsOwnLine() {
        store(telnyx("t1", "acme", Map.of("callerNumber", "+56900000000")));
        assertTrue(telephony.lines("other-tenant").isEmpty());
    }

    @Test
    void withoutItsOwnTelnyxAnOrganizationUsesThePlatformsManagedLine() {
        store(telnyx("p1", PlatformScope.TENANT, Map.of("callerNumber", "+56 2 0000 0000")));

        List<TelephonyLine> lines = telephony.lines("acme");

        assertEquals(1, lines.size());
        assertTrue(lines.get(0).managed());
        assertEquals("p1", lines.get(0).connectionId());
        assertTrue(telephony.lines(PlatformScope.TENANT).stream().noneMatch(TelephonyLine::managed));
    }

    @Test
    void aManagedTokenRecordsTheCallAndTheOperatorsLogin() {
        store(telnyx("p1", PlatformScope.TENANT, Map.of("callerNumber", "+56220000000", "sipConnectionId", "sip-1")));

        WebRtcToken token = telephony.webRtcToken("acme", "p1", "ana@example.com", "+56 9 1111 1111", "case-7");

        assertEquals("eyJ.placeholder", token.token());
        UsageRow row = usage.find(token.callRef()).orElseThrow();
        assertEquals("acme", row.tenantCode());
        assertTrue(row.managed());
        assertEquals(UsageRow.STARTED, row.status());
        assertEquals("+56911111111", row.calleeNumber());
        assertEquals(TelephonyPlanDtos.CL_MOBILE, row.destinationType());
        assertEquals("case-7", row.caseRef());
        assertEquals("acme", usage.tenantOfSip("gencred-acme-1", "sip-1").orElseThrow());

        telephony.callEnded("other", token.callRef(), "v3:control-1");
        assertEquals(UsageRow.STARTED, usage.find(token.callRef()).orElseThrow().status(), "another tenant's ref");
        telephony.callEnded("acme", token.callRef(), "v3:control-1");
        UsageRow ended = usage.find(token.callRef()).orElseThrow();
        assertEquals(UsageRow.ENDED, ended.status());
        assertNull(ended.externalId(), "browser IDs cannot bind a provider ledger row");
        assertNull(ended.billedMinutes(), "the browser's report is not billed");
    }

    @Test
    void anEnforcedPlanRefusesAManagedCallPastTheMinutes() {
        store(telnyx("p1", PlatformScope.TENANT, Map.of("callerNumber", "+56220000000", "sipConnectionId", "sip-1")));
        usage.setPlan(new Plan(1, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ZERO, BigDecimal.ZERO,
                true, null, null), "owner");
        usage.insert(new UsageRow("u1", "acme", UsageRow.VOICE, true, "p1", "v3:old", null, "+56911111111",
                TelephonyPlanDtos.CL_MOBILE, UsageRow.CONFIRMED, NOW, 61, 2, null, null, UsageRow.SOURCE_WEBHOOK,
                NOW.minusSeconds(3600), NOW.minusSeconds(3500), NOW.minusSeconds(3500)));

        TelephonyUnavailableException e = assertThrows(TelephonyUnavailableException.class,
                () -> telephony.webRtcToken("acme", "p1", "ana@example.com", "+56911111111", null));
        assertEquals(TelephonyUnavailableException.QUOTA_EXHAUSTED, e.code());
        assertTrue(http.seen().isEmpty(), "Telnyx is not asked");
    }

    @Test
    void aFullLineRefusesTheNextCall() {
        store(telnyx("t1", "acme", Map.of("callerNumber", "+56220000000", "sipConnectionId", "sip-1",
                "channelLimit", "1")));
        telephony.webRtcToken("acme", "t1", "ana@example.com", "+56911111111", null);

        TelephonyUnavailableException e = assertThrows(TelephonyUnavailableException.class,
                () -> telephony.webRtcToken("acme", "t1", "luis@example.com", "+56922222222", null));
        assertEquals(TelephonyUnavailableException.CHANNELS_BUSY, e.code());
    }

    @Test
    void failedTokenMintReleasesItsReservation() {
        store(telnyx("t1", "acme", Map.of("sipConnectionId", "sip-1", "channelLimit", 1)));
        http.reply("POST /v2/telephony_credentials/new-1/token", 500, "{}");
        assertThrows(TelephonyUnavailableException.class,
                () -> telephony.webRtcToken("acme", "t1", "ana@example.com", "+56911111111", null));
        assertEquals(0, usage.busyChannels("t1", NOW.minusSeconds(10)));
    }

    @Test
    void theChannelLimitDefaultsToTen() {
        assertEquals(10, IntegrationsTelephony.channelLimit(telnyx("t1", "acme", Map.of())));
        assertEquals(10, IntegrationsTelephony.channelLimit(telnyx("t1", "acme", Map.of("channelLimit", "x"))));
        assertEquals(3, IntegrationsTelephony.channelLimit(telnyx("t1", "acme", Map.of("channelLimit", 3))));
    }

    @Test
    void e164AcceptsSeparatorsOnly() {
        assertEquals("+56900000000", PhoneNumbers.e164("+56 (9) 0000-0000"));
        assertEquals("+6834001", PhoneNumbers.e164("+683 4001"));
        assertNull(PhoneNumbers.e164("+683400"));
        assertEquals("+123456789012345", PhoneNumbers.e164("+123456789012345"));
        assertNull(PhoneNumbers.e164("+1234567890123456"));
        assertNull(PhoneNumbers.e164("56900000000"));
        assertNull(PhoneNumbers.e164("+0123456789"));
        assertNull(PhoneNumbers.e164(null));
    }

    private static IntegrationConnection telnyx(String id, String tenant, Map<String, Object> metadata) {
        return new IntegrationConnection(id, tenant, "Line " + id, ProviderType.TELNYX, API, "cred",
                ConnectionStatus.ACTIVE, null, null, metadata);
    }
}

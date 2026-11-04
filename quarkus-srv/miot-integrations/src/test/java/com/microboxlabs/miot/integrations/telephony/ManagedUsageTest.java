package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Plan;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Usage;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ManagedUsageTest {

    private static final Instant NOW = Instant.parse("2026-11-04T10:00:00Z");
    private static final URI API = URI.create("https://api.telnyx.test");

    private final InMemoryTelephonyUsageStore usage = new InMemoryTelephonyUsageStore();
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final TelnyxCallEvents events = new TelnyxCallEvents(usage, new InboundRouter(usage), new ObjectMapper(),
            clock);

    private UsageRow started(String id, String tenant, String callee, Instant at) {
        UsageRow r = new UsageRow(id, tenant, UsageRow.VOICE, true, "p1", null, null, callee,
                TelephonyPlanService.destinationType(callee), UsageRow.STARTED, null, null, null, null, null, null, at,
                null, null);
        usage.insert(r);
        return r;
    }

    private static String event(String type, String ref, String callControlId, String occurredAt, String extra) {
        String state = ref == null ? "" : "\"client_state\":\""
                + Base64.getEncoder().encodeToString(ref.getBytes(StandardCharsets.UTF_8)) + "\",";
        return "{\"data\":{\"event_type\":\"" + type + "\",\"occurred_at\":\"" + occurredAt + "\",\"payload\":{"
                + state + "\"call_control_id\":\"" + callControlId + "\"" + extra + "}}}";
    }

    @Test
    void theWebhookConfirmsTheSecondsFromTheAnswer() {
        started("00000000-0000-0000-0000-000000000001", "acme", "+56911111111", NOW.minusSeconds(120));
        String ref = "00000000-0000-0000-0000-000000000001";

        events.apply("p1", event("call.initiated", ref, "v3:c1", "2026-11-04T09:58:00Z", ",\"direction\":\"outgoing\""));
        events.apply("p1", event("call.answered", ref, "v3:c1", "2026-11-04T09:58:10Z", ""));
        TelnyxCallEvents.Outcome out = events.apply("p1", event("call.hangup", ref, "v3:c1", "2026-11-04T09:59:20Z",
                ",\"end_time\":\"2026-11-04T09:59:20Z\",\"hangup_cause\":\"normal_clearing\""));

        assertEquals(UsageRow.CONFIRMED, out.status());
        UsageRow row = usage.find(ref).orElseThrow();
        assertEquals("v3:c1", row.externalId());
        assertEquals(70, row.seconds());
        assertEquals(2, row.billedMinutes(), "70 seconds bill 2 minutes");
        assertEquals(UsageRow.SOURCE_WEBHOOK, row.source());
    }

    @Test
    void anUnansweredCallIsZeroMinutesAndAnotherConnectionsEventIsIgnored() {
        String ref = "00000000-0000-0000-0000-000000000002";
        started(ref, "acme", "+56911111111", NOW.minusSeconds(60));

        assertNull(events.apply("other-connection", event("call.hangup", ref, "v3:c2", "2026-11-04T09:59:30Z", ""))
                .rowId());
        events.apply("p1", event("call.hangup", ref, "v3:c2", "2026-11-04T09:59:30Z", ""));

        UsageRow row = usage.find(ref).orElseThrow();
        assertEquals(0, row.billedMinutes());
        assertEquals(UsageRow.CONFIRMED, row.status());
    }

    @Test
    void aCallBackGoesToTheOrganizationThatCalledLast() {
        started("00000000-0000-0000-0000-000000000003", "acme", "+56911111111", NOW.minusSeconds(7200));
        started("00000000-0000-0000-0000-000000000004", "beta", "+56911111111", NOW.minusSeconds(600));
        started("00000000-0000-0000-0000-000000000005", "gamma", "+56922222222", NOW.minusSeconds(60));

        events.apply("p1", event("call.hangup", "00000000-0000-0000-0000-000000000004", "v3:out",
                NOW.minusSeconds(500).toString(), ",\"to\":\"+56911111111\""));
        TelnyxCallEvents.Outcome out = events.apply("p1", event("call.initiated", null, "v3:in", NOW.toString(),
                ",\"direction\":\"incoming\",\"from\":\"+56 9 1111 1111\""));
        assertEquals("beta", out.routedTenant());
        assertNull(events.apply("p1", event("call.initiated", null, "v3:in2", NOW.toString(),
                ",\"direction\":\"incoming\",\"from\":\"+56933333333\"")).routedTenant(), "the platform notice");
        assertNull(events.apply("p1", event("call.initiated", null, "v3:in3", NOW.plusSeconds(25 * 3600).toString(),
                ",\"direction\":\"incoming\",\"from\":\"+56911111111\"")).routedTenant(), "older than 24 hours");
    }

    @Test
    void lateAnswerRepairsWebhookDurationAndProviderDestinationWins() {
        String ref = "00000000-0000-0000-0000-000000000030";
        started(ref, "acme", "+56221111111", NOW.minusSeconds(120));
        events.apply("p1", event("call.hangup", ref, "v3:late", NOW.toString(), ",\"to\":\"+51911111111\""));
        events.apply("p1", event("call.answered", ref, "v3:late", NOW.minusSeconds(65).toString(), ""));
        UsageRow row = usage.find(ref).orElseThrow();
        assertEquals(65, row.seconds());
        assertEquals(2, row.billedMinutes());
        assertEquals("+51911111111", row.calleeNumber());
        assertEquals(TelephonyPlanDtos.OTHER, row.destinationType());
    }

    @Test
    void delayedWebhookUsesTheCdrRowWithoutDoubleBillingOrOverwritingIt() throws Exception {
        String ref = "00000000-0000-0000-0000-000000000031";
        started(ref, "acme", "+56221111111", NOW.minusSeconds(120));
        usage.saveCredential("login", "acme", "cred", "sip-1");
        TelnyxUsageReconciler reconciler = new TelnyxUsageReconciler(t -> null, null, null, usage,
                new ObjectMapper(), clock, true);
        assertEquals(TelnyxUsageReconciler.Applied.CREATED, reconciler.apply("p1", new ObjectMapper().readTree(
                cdr("v3:canonical", "login", "sip-1", NOW.minusSeconds(61).toString(), 61, "0.2")), NOW));
        events.apply("p1", event("call.hangup", ref, "v3:canonical", NOW.toString(), ",\"to\":\"+51911111111\""));
        events.apply("p1", event("call.answered", ref, "v3:canonical", NOW.minusSeconds(1).toString(), ""));
        assertEquals(UsageRow.EXPIRED, usage.find(ref).orElseThrow().status());
        assertEquals(2, usage.billedMinutes("acme", NOW.minusSeconds(7200), NOW.plusSeconds(1)));
        UsageRow canonical = usage.findByExternal(UsageRow.VOICE, "v3:canonical").orElseThrow();
        assertEquals(61, canonical.seconds());
        assertEquals(UsageRow.SOURCE_DETAIL_RECORD, canonical.source());
        assertEquals("+56911111111", canonical.calleeNumber());
    }

    @Test
    void cdrCannotMoveACaseToAnotherTenantOrUseAnotherSipConnection() throws Exception {
        usage.saveCredential("login", "beta", "cred", "sip-1");
        assertTrue(usage.tenantOfSip("login", "sip-other").isEmpty());
        String ref = "00000000-0000-0000-0000-000000000032";
        started(ref, "acme", "+56221111111", NOW.minusSeconds(120));
        events.apply("p1", event("call.initiated", ref, "v3:conflict", NOW.toString(), ""));
        TelnyxUsageReconciler reconciler = new TelnyxUsageReconciler(t -> null, null, null, usage,
                new ObjectMapper(), clock, true);
        assertEquals(TelnyxUsageReconciler.Applied.SKIPPED, reconciler.apply("p1", new ObjectMapper().readTree(
                cdr("v3:conflict", "login", "sip-1", NOW.minusSeconds(61).toString(), 61, "0.2")), NOW));
        assertEquals("acme", usage.find(ref).orElseThrow().tenantCode());
        assertEquals(0, usage.billedMinutes("beta", NOW.minusSeconds(7200), NOW.plusSeconds(1)));
    }

    @Test
    void theSignatureIsChecked() throws Exception {
        KeyPair pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
        byte[] der = pair.getPublic().getEncoded();
        String raw = Base64.getEncoder().encodeToString(Arrays.copyOfRange(der, der.length - 32, der.length));
        String body = "{\"data\":{}}";
        String ts = String.valueOf(NOW.getEpochSecond());
        Signature signer = Signature.getInstance("Ed25519");
        signer.initSign(pair.getPrivate());
        signer.update((ts + "|" + body).getBytes(StandardCharsets.UTF_8));
        String sig = Base64.getEncoder().encodeToString(signer.sign());

        assertTrue(TelnyxWebhookVerifier.verify(raw, sig, ts, body, NOW));
        assertTrue(TelnyxWebhookVerifier.verify(Base64.getEncoder().encodeToString(der), sig, ts, body, NOW),
                "an X.509 key works too");
        assertFalse(TelnyxWebhookVerifier.verify(raw, sig, ts, body + " ", NOW), "a changed body");
        assertFalse(TelnyxWebhookVerifier.verify(raw, sig, ts, body, NOW.plusSeconds(301)), "an old delivery");
        assertFalse(TelnyxWebhookVerifier.verify(raw, "bm90LWEtc2lnbmF0dXJl", ts, body, NOW));
        assertFalse(TelnyxWebhookVerifier.verify(raw, null, ts, body, NOW));
    }

    @Test
    void detailRecordsConfirmByTheSipLoginsOrganization() {
        usage.saveCredential("gencred-acme", "acme", "cred-1", "sip-1");
        String ref = "00000000-0000-0000-0000-000000000006";
        started(ref, "acme", "+56911111111", NOW.minusSeconds(3600));
        UsageRow ended = usage.find(ref).orElseThrow();
        usage.update(new UsageRow(ref, "acme", UsageRow.VOICE, true, "p1", "v3:c6", null, "+56221111111",
                TelephonyPlanDtos.CL_LANDLINE, UsageRow.ENDED, null, null, null, null, null, null, ended.startedAt(),
                NOW.minusSeconds(3500), null));
        StubHttp http = new StubHttp().reply("/v2/detail_records", 200, "{\"data\":["
                + cdr("v3:c6", "gencred-acme", "sip-1", "2026-11-04T09:00:05Z", 95, "0.0123")
                + "," + cdr("v3:c7", "gencred-acme", "sip-1", null, 0, "0")
                + "," + cdr("v3:c8", "gencred-unknown", "sip-1", "2026-11-04T09:00:05Z", 30, "0.01")
                + "," + cdr("v3:c9", "gencred-acme", "sip-other", "2026-11-04T09:00:05Z", 30, "0.01")
                + "],\"meta\":{\"total_pages\":1}}");
        IntegrationConnection platform = new IntegrationConnection("p1", PlatformScope.TENANT, "Telnyx",
                ProviderType.TELNYX, API, "cred", ConnectionStatus.ACTIVE, null, null, Map.of());
        TelnyxUsageReconciler reconciler = new TelnyxUsageReconciler(t -> platform,
                (t, c) -> new ResolvedConnection(c.id(), c.baseUrl(), Map.of("sipConnectionId", "sip-1"),
                        Map.of("token", "KEY_test")),
                new TelnyxClient(http, API), usage, new ObjectMapper(), clock, true);

        TelnyxUsageReconciler.Result result = reconciler.run();

        assertEquals(new TelnyxUsageReconciler.Result(3, 1, 1, 1, 0), result);
        UsageRow confirmed = usage.find(ref).orElseThrow();
        assertEquals("+56911111111", confirmed.calleeNumber(), "the actual provider destination replaces the declaration");
        assertEquals(TelephonyPlanDtos.CL_MOBILE, confirmed.destinationType());
        assertEquals(95, confirmed.seconds());
        assertEquals(2, confirmed.billedMinutes());
        assertEquals(new BigDecimal("0.0123"), confirmed.providerCost());
        UsageRow unanswered = usage.findByExternal(UsageRow.VOICE, "v3:c7").orElseThrow();
        assertEquals(0, unanswered.billedMinutes());
        assertEquals("acme", unanswered.tenantCode());
        assertTrue(usage.findByExternal(UsageRow.VOICE, "v3:c8").isEmpty(), "an unknown login is not charged");
        assertTrue(http.last().request().uri().getRawQuery().contains("sip-trunking"));
        assertEquals(new TelnyxUsageReconciler.Result(3, 0, 0, 3, 0), reconciler.run(), "a second run changes nothing");
    }

    private static String cdr(String callControlId, String login, String connection, String answeredAt, int seconds,
            String cost) {
        return "{\"call_control_id\":\"" + callControlId + "\",\"auth_username\":\"" + login + "\",\"connection_id\":\""
                + connection + "\",\"cld\":\"56911111111\",\"started_at\":\"2026-11-04T09:00:00Z\",\"answered_at\":"
                + (answeredAt == null ? "null" : "\"" + answeredAt + "\"") + ",\"finished_at\":\"2026-11-04T09:01:40Z\","
                + "\"call_sec\":" + seconds + ",\"billed_sec\":" + seconds + ",\"cost\":\"" + cost
                + "\",\"currency\":\"USD\",\"is_webrtc\":true}";
    }

    @Test
    void stalledStartsExpireAndFreeTheirChannel() {
        started("00000000-0000-0000-0000-000000000010", "acme", "+56911111111", NOW.minusSeconds(3 * 3600));
        assertEquals(1, usage.busyChannels("p1", NOW.minusSeconds(4 * 3600)));
        TelnyxUsageReconciler reconciler = new TelnyxUsageReconciler(t -> null, null, null, usage,
                new ObjectMapper(), clock, true);
        assertEquals(1, reconciler.run().expired());
        assertEquals(0, usage.busyChannels("p1", NOW.minusSeconds(4 * 3600)));
    }

    @Test
    void theMonthIsChargedByDestinationAndTemplates() {
        usage.setPlan(new Plan(100, new BigDecimal("0.10"), new BigDecimal("0.05"), new BigDecimal("0.50"),
                new BigDecimal("0.02"), new BigDecimal("0.03"), false, null, null), "owner");
        confirmed("v1", "+56911111111", 61);
        confirmed("v2", "+56911111111", 59);
        confirmed("v3", "+56221111111", 120);
        new ManagedUsageRecorder(usage).whatsAppTemplate("acme", PlatformScope.TENANT, "wamid.1", NOW);
        new ManagedUsageRecorder(usage).whatsAppTemplate("acme", PlatformScope.TENANT, "wamid.1", NOW);
        new ManagedUsageRecorder(usage).whatsAppTemplate("acme", "acme", "wamid.2", NOW);
        started("00000000-0000-0000-0000-000000000020", "acme", "+56911111111", NOW);

        Usage u = new TelephonyPlanService(usage, clock).usage("acme", YearMonth.of(2026, 11));

        assertEquals(5, u.usedMinutes(), "2 + 1 mobile, 2 landline");
        assertEquals(1, u.pending());
        assertEquals(100, u.quotaMinutes());
        assertEquals(0, new BigDecimal("0.43").compareTo(u.chargeUsd()), "3 x 0.10 + 2 x 0.05 + 1 x 0.03");
        assertEquals(3, u.lines().size());
        assertNull(u.withoutProviderCost().providerCost());
    }

    @Test
    void chileanNumbersAreMobileOrLandline() {
        assertEquals(TelephonyPlanDtos.CL_MOBILE, TelephonyPlanService.destinationType("+56 9 1111 1111"));
        assertEquals(TelephonyPlanDtos.CL_LANDLINE, TelephonyPlanService.destinationType("+56 2 2111 1111"));
        assertEquals(TelephonyPlanDtos.OTHER, TelephonyPlanService.destinationType("+51 911 111 111"));
        assertEquals(0, UsageRow.billedMinutes(0));
        assertEquals(1, UsageRow.billedMinutes(1));
        assertEquals(1, UsageRow.billedMinutes(60));
        assertEquals(2, UsageRow.billedMinutes(61));
    }

    private void confirmed(String id, String callee, int seconds) {
        usage.insert(new UsageRow(java.util.UUID.randomUUID().toString(), "acme", UsageRow.VOICE, true, "p1", id,
                null, callee, TelephonyPlanService.destinationType(callee), UsageRow.CONFIRMED, NOW, seconds,
                UsageRow.billedMinutes(seconds), null, null, UsageRow.SOURCE_DETAIL_RECORD, NOW, NOW, NOW));
    }
}

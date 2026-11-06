package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.core.telephony.InboundCallers;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.core.telephony.WebRtcToken;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Line;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Plan;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class WhatsAppCallsTest {

    private static final URI API = URI.create("https://api.telnyx.test");
    private static final Instant NOW = Instant.parse("2026-11-04T10:00:00Z");
    private static final String DRIVER = "+56911111111";
    private static final String APP = "wa-app-1";

    private final ObjectMapper json = new ObjectMapper();
    private final MutableClock clock = new MutableClock(NOW);
    private final InMemoryTelephonyUsageStore usage = new InMemoryTelephonyUsageStore();
    private final InMemoryWhatsAppCallStore calls = new InMemoryWhatsAppCallStore();
    private final StubHttp http = new StubHttp()
            .reply("GET /v2/telephony_credentials", 200, "{\"data\":[]}")
            .reply("POST /v2/telephony_credentials/new-1/token", 201, "eyJ.placeholder")
            .reply("POST /v2/telephony_credentials", 201,
                    "{\"data\":{\"id\":\"new-1\",\"sip_username\":\"gencred-acme-1\"}}")
            .reply("POST /v2/calls/", 200, "{\"data\":{}}")
            .reply("POST /v2/calls", 200, "{\"data\":{\"call_control_id\":\"wa-leg-1\"}}");
    private final IntegrationConnection managed = new IntegrationConnection("p1", PlatformScope.TENANT, "Line",
            ProviderType.TELNYX, API, "cred", ConnectionStatus.ACTIVE, null, null,
            Map.of("sipConnectionId", "sip-1", "callerNumber", "+56220000000"));
    private final Map<String, IntegrationConnection> byKey = new HashMap<>(
            Map.of(PlatformScope.TENANT + "|" + ProviderType.TELNYX, managed));
    private final Map<String, InboundCallers.Caller> book = new HashMap<>();
    private Optional<Boolean> permission = Optional.empty();

    private final TelnyxClient client = new TelnyxClient(http, API);
    private final TelephonyPlanService plan = new TelephonyPlanService(usage, clock);

    private WhatsAppSipConfig config = config("DTLS");

    private static WhatsAppSipConfig config(String encryption) {
        return new WhatsAppSipConfig(APP, "meta.sip.test", "+56 2 2000 0000", "56220000000", "placeholder-secret",
                encryption, Duration.ofSeconds(30), "No hay operadores.");
    }

    private WhatsAppCalls whatsApp() {
        return new WhatsAppCalls(config, usage, calls, client, id -> "KEY_test", e164 -> Optional.ofNullable(book.get(e164)),
                new InboundRouter(usage), json, clock);
    }

    private TelnyxCallEvents events(WhatsAppCalls whatsApp) {
        TelnyxParkedCalls parked = new TelnyxParkedCalls(id -> managed,
                (t, c) -> new ResolvedConnection(c.id(), c.baseUrl(), c.metadata(), Map.of("token", "KEY_test")),
                usage, plan, client, clock, whatsApp);
        return new TelnyxCallEvents(usage, new InboundRouter(usage), json, clock, parked);
    }

    private IntegrationsTelephony telephony(WhatsAppCalls whatsApp) {
        http.reply("GET /v2/credential_connections", 200, TelnyxWebRtcTokensTest.parked(managed.id()));
        TelnyxWebRtcTokens tokens = new TelnyxWebRtcTokens(
                (tenant, id) -> byKey.values().stream()
                        .filter(c -> c.tenantCode().equals(tenant) && c.id().equals(id)).findFirst().orElse(null),
                (tenant, c) -> new ResolvedConnection(c.id(), c.baseUrl(), c.metadata(), Map.of("token", "KEY_test")),
                client, json, clock, "https://miot.test");
        return new IntegrationsTelephony((tenant, provider) -> byKey.get(tenant + "|" + provider), tokens, null,
                usage, plan, clock, whatsApp, (tenant, phone) -> permission);
    }

    private static String b64(String s) {
        return Base64.getEncoder().encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }

    private static String event(String type, Map<String, String> payload) {
        StringBuilder p = new StringBuilder();
        payload.forEach((k, v) -> p.append(p.isEmpty() ? "" : ",").append('"').append(k).append("\":\"").append(v)
                .append('"'));
        return "{\"data\":{\"event_type\":\"" + type + "\",\"occurred_at\":\"" + NOW + "\",\"payload\":{" + p + "}}}";
    }

    private static String parkedLeg(String type, String callRef, String callId) {
        return event(type, Map.of("direction", "outgoing", "state", "parked", "to", DRIVER, "connection_id", "sip-1",
                "call_control_id", callId, "client_state", b64(callRef)));
    }

    private String waLeg(String type, String callRef, String callId, Map<String, String> extra) {
        Map<String, String> p = new HashMap<>(Map.of("direction", "outgoing", "connection_id", APP,
                "to", "sip:+56911111111@wa.meta.vc", "call_control_id", callId,
                "client_state", b64(WhatsAppCalls.LEG + usage.admission(callRef).orElseThrow().targetState())));
        p.putAll(extra);
        return event(type, p);
    }

    private JsonNode body(StubHttp.Seen seen) throws Exception {
        return json.readTree(seen.body());
    }

    private StubHttp.Seen sent(String pathSuffix) {
        return http.seen().stream().filter(s -> s.path().endsWith(pathSuffix)).reduce((a, b) -> b).orElse(null);
    }

    @Test
    void anAdmittedWhatsAppReservationDialsTheContactOnTheWhatsAppAppAndBridgesOnAnswer() throws Exception {
        WhatsAppCalls whatsApp = whatsApp();
        IntegrationsTelephony telephony = telephony(whatsApp);
        TelnyxCallEvents events = events(whatsApp);
        assertTrue(telephony.whatsAppCalling("acme"));

        WebRtcToken token = telephony.whatsAppCall("acme", "p1", "op@acme.test", DRIVER, "case-7");
        String ref = token.callRef();
        assertEquals(UsageRow.WHATSAPP_CALL, usage.find(ref).orElseThrow().channel());

        events.apply("p1", parkedLeg("call.initiated", ref, "sdk-1"));
        StubHttp.Seen dial = http.last();
        assertEquals("/v2/calls", dial.path());
        JsonNode d = body(dial);
        assertEquals(APP, d.path("connection_id").asText());
        assertEquals("sip:+56911111111@wa.meta.vc:5061;transport=tls", d.path("to").asText());
        assertEquals("sip:+56220000000@meta.sip.test", d.path("from").asText());
        assertEquals("56220000000", d.path("sip_auth_username").asText());
        assertEquals("TLS", d.path("sip_transport_protocol").asText());
        assertEquals("DTLS", d.path("media_encryption").asText());
        assertEquals("OPUS", d.path("preferred_codecs").asText());
        assertEquals("sdk-1", d.path("link_to").asText());
        assertNull(sent("/actions/transfer"), "a WhatsApp call never reaches the PSTN");
        assertEquals("wa-leg-1", calls.leg(ref).orElseThrow());

        events.apply("p1", waLeg("call.initiated", ref, "wa-leg-1", Map.of()));
        events.apply("p1", waLeg("call.answered", ref, "wa-leg-1", Map.of()));
        StubHttp.Seen bridge = sent("/actions/bridge");
        assertEquals("/v2/calls/sdk-1/actions/bridge", bridge.path());
        assertEquals("wa-leg-1", body(bridge).path("call_control_id").asText());
        assertEquals(NOW, usage.find(ref).orElseThrow().answeredAt());

        clock.at = NOW.plusSeconds(61);
        events.apply("p1", waLeg("call.hangup", ref, "wa-leg-1", Map.of("end_time", NOW.plusSeconds(61).toString())));
        UsageRow row = usage.find(ref).orElseThrow();
        assertEquals(UsageRow.CONFIRMED, row.status());
        assertEquals(2, row.billedMinutes());
        assertEquals(DRIVER, row.calleeNumber(), "the SIP address does not replace the contact's number");
        assertEquals("/v2/calls/sdk-1/actions/hangup", sent("/sdk-1/actions/hangup").path());
        assertTrue(telephony.callFailure("acme", ref).isEmpty());
    }

    @Test
    void aSipForbiddenFromMetaIsReportedAsNoPermission() {
        WhatsAppCalls whatsApp = whatsApp();
        IntegrationsTelephony telephony = telephony(whatsApp);
        TelnyxCallEvents events = events(whatsApp);
        String ref = telephony.whatsAppCall("acme", "p1", "op@acme.test", DRIVER, null).callRef();
        events.apply("p1", parkedLeg("call.initiated", ref, "sdk-1"));
        events.apply("p1", waLeg("call.hangup", ref, "wa-leg-1",
                Map.of("sip_hangup_cause", "403", "hangup_cause", "call_rejected")));

        assertEquals(Optional.of(TelephonyUnavailableException.WHATSAPP_NO_PERMISSION),
                telephony.callFailure("acme", ref));
        assertTrue(telephony.callFailure("other", ref).isEmpty(), "another organization cannot read it");
        assertEquals(0, usage.find(ref).orElseThrow().billedMinutes());
        assertTrue(sent("/sdk-1/actions/hangup") != null, "the operator's leg ends with it");
    }

    @Test
    void aContactWithoutPermissionIsRefusedBeforeAnyReservation() {
        permission = Optional.of(false);
        IntegrationsTelephony telephony = telephony(whatsApp());
        TelephonyUnavailableException e = assertThrows(TelephonyUnavailableException.class,
                () -> telephony.whatsAppCall("acme", "p1", "op@acme.test", DRIVER, null));
        assertEquals(TelephonyUnavailableException.WHATSAPP_NO_PERMISSION, e.code());
        assertEquals(0, usage.busyChannels("p1", NOW.minusSeconds(1)));

        permission = Optional.of(true);
        assertTrue(telephony.whatsAppCall("acme", "p1", "op@acme.test", DRIVER, null).callRef() != null);
    }

    @Test
    void missingConfigurationTurnsWhatsAppCallingOff() {
        config = new WhatsAppSipConfig(APP, "meta.sip.test", "+56220000000", "56220000000", null, "DTLS",
                Duration.ofSeconds(30), "x");
        assertFalse(config.enabled());
        assertFalse(config("NONE").enabled(), "only DTLS or SRTP");
        IntegrationsTelephony telephony = telephony(whatsApp());
        assertFalse(telephony.whatsAppCalling("acme"));
        TelephonyUnavailableException e = assertThrows(TelephonyUnavailableException.class,
                () -> telephony.whatsAppCall("acme", "p1", "op@acme.test", DRIVER, null));
        assertEquals(TelephonyUnavailableException.WHATSAPP_UNAVAILABLE, e.code());
        assertFalse(new IntegrationsTelephony((t, p) -> byKey.get(t + "|" + p), null, null, usage, plan, clock)
                .whatsAppCalling("acme"), "a build without WhatsApp calls");
    }

    @Test
    void anOrganizationWithItsOwnTelnyxLineCannotReachWhatsApp() {
        byKey.put("acme|" + ProviderType.TELNYX, new IntegrationConnection("own-1", "acme", "Own", ProviderType.TELNYX,
                API, "cred", ConnectionStatus.ACTIVE, null, null, Map.of("callerNumber", "+56220000001")));
        IntegrationsTelephony telephony = telephony(whatsApp());
        assertFalse(telephony.whatsAppCalling("acme"));
        assertThrows(TelephonyUnavailableException.class,
                () -> telephony.whatsAppCall("acme", "own-1", "op@acme.test", DRIVER, null));
    }

    @Test
    void aKnownDriversCallRingsInTheTowerAndIsBridgedToTheOperatorWhoTakesIt() throws Exception {
        book.put(DRIVER, new InboundCallers.Caller("acme", "Juan Pérez", "4711"));
        WhatsAppCalls whatsApp = whatsApp();
        IntegrationsTelephony telephony = telephony(whatsApp);
        TelnyxCallEvents events = events(whatsApp);

        events.apply("p1", event("call.initiated", Map.of("direction", "incoming", "connection_id", APP,
                "from", "sip:+56911111111@wa.meta.vc", "to", "sip:+56220000000@meta.sip.test",
                "call_control_id", "wa-in-1")));
        var ringing = telephony.ringingWhatsAppCalls("acme");
        assertEquals(1, ringing.size());
        assertEquals("Juan Pérez", ringing.get(0).callerName());
        assertEquals("4711", ringing.get(0).caseRef());
        assertEquals(DRIVER, ringing.get(0).callerNumber());
        assertTrue(telephony.ringingWhatsAppCalls("other").isEmpty());
        assertNull(sent("/wa-in-1/actions/answer"), "it rings until an operator takes it");

        String inboundId = ringing.get(0).id();
        String ref = telephony.answerWhatsAppCall("acme", "p1", "op@acme.test", inboundId).callRef();
        TelephonyUnavailableException taken = assertThrows(TelephonyUnavailableException.class,
                () -> telephony.answerWhatsAppCall("acme", "p1", "other@acme.test", inboundId));
        assertEquals(TelephonyUnavailableException.WHATSAPP_CALL_TAKEN, taken.code());
        UsageRow row = usage.find(ref).orElseThrow();
        assertEquals(UsageRow.WHATSAPP_INBOUND, row.destinationType());
        assertEquals("4711", row.caseRef());

        events.apply("p1", parkedLeg("call.initiated", ref, "sdk-in"));
        StubHttp.Seen answer = sent("/wa-in-1/actions/answer");
        String state = TelnyxCallEvents.decode(body(answer).path("client_state").asText());
        assertTrue(state.startsWith(WhatsAppCalls.LEG));
        assertNull(sent("/v2/calls"), "nothing is dialed for an inbound call");

        events.apply("p1", waLeg("call.answered", ref, "wa-in-1", Map.of("direction", "incoming")));
        assertEquals("/v2/calls/sdk-in/actions/bridge", sent("/actions/bridge").path());
        assertEquals(InboundWhatsAppCall.ANSWERED, calls.inbound(inboundId).orElseThrow().status());

        clock.at = NOW.plusSeconds(30);
        events.apply("p1", waLeg("call.hangup", ref, "wa-in-1",
                Map.of("direction", "incoming", "end_time", NOW.plusSeconds(30).toString())));
        assertEquals(UsageRow.CONFIRMED, usage.find(ref).orElseThrow().status());
        assertEquals(InboundWhatsAppCall.ENDED, calls.inbound(inboundId).orElseThrow().status());
    }

    @Test
    void anUnknownCallerHearsTheMessageAndIsHungUp() throws Exception {
        TelnyxCallEvents events = events(whatsApp());
        events.apply("p1", event("call.initiated", Map.of("direction", "incoming", "connection_id", APP,
                "from", "+56999999999", "call_control_id", "wa-in-2")));
        InboundWhatsAppCall call = calls.inboundByCallControl("wa-in-2").orElseThrow();
        assertNull(call.tenantCode());
        assertEquals(InboundWhatsAppCall.MISSED, call.status());
        String bye = body(sent("/wa-in-2/actions/answer")).path("client_state").asText();

        events.apply("p1", event("call.answered", Map.of("connection_id", APP, "call_control_id", "wa-in-2",
                "client_state", bye)));
        assertEquals("No hay operadores.", body(sent("/wa-in-2/actions/speak")).path("payload").asText());
        events.apply("p1", event("call.speak.ended", Map.of("connection_id", APP, "call_control_id", "wa-in-2",
                "client_state", bye)));
        assertTrue(sent("/wa-in-2/actions/hangup") != null);
    }

    @Test
    void aCallNobodyTakesInTimeIsAnsweredWithTheMessage() {
        book.put(DRIVER, new InboundCallers.Caller("acme", "Juan", null));
        WhatsAppCalls whatsApp = whatsApp();
        events(whatsApp).apply("p1", event("call.initiated", Map.of("direction", "incoming", "connection_id", APP,
                "from", DRIVER, "call_control_id", "wa-in-3")));
        assertEquals(0, whatsApp.expireRinging());
        clock.at = NOW.plusSeconds(31);
        assertEquals(1, whatsApp.expireRinging());
        assertEquals(InboundWhatsAppCall.MISSED, calls.inboundByCallControl("wa-in-3").orElseThrow().status());
        assertTrue(sent("/wa-in-3/actions/answer") != null);
        assertTrue(whatsApp.ringing("acme").isEmpty());
    }

    @Test
    void aCallerWhoHangsUpWhileRingingIsMissed() {
        book.put(DRIVER, new InboundCallers.Caller("acme", "Juan", null));
        TelnyxCallEvents events = events(whatsApp());
        events.apply("p1", event("call.initiated", Map.of("direction", "incoming", "connection_id", APP,
                "from", DRIVER, "call_control_id", "wa-in-4")));
        events.apply("p1", event("call.hangup", Map.of("direction", "incoming", "connection_id", APP,
                "call_control_id", "wa-in-4")));
        assertEquals(InboundWhatsAppCall.MISSED, calls.inboundByCallControl("wa-in-4").orElseThrow().status());
    }

    @Test
    void anOperatorWhoGivesUpBeforeAdmissionLeavesTheCallRinging() {
        book.put(DRIVER, new InboundCallers.Caller("acme", "Juan", null));
        WhatsAppCalls whatsApp = whatsApp();
        IntegrationsTelephony telephony = telephony(whatsApp);
        events(whatsApp).apply("p1", event("call.initiated", Map.of("direction", "incoming", "connection_id", APP,
                "from", DRIVER, "call_control_id", "wa-in-5")));
        String id = whatsApp.ringing("acme").get(0).id();
        String ref = telephony.answerWhatsAppCall("acme", "p1", "op@acme.test", id).callRef();
        assertTrue(whatsApp.ringing("acme").isEmpty());
        telephony.callEnded("acme", ref, null);
        assertEquals(1, whatsApp.ringing("acme").size());
    }

    @Test
    void anUnknownNumberCalledBackRecentlyIsRoutedByTheLedger() {
        usage.insert(new UsageRow("00000000-0000-0000-0000-000000000001", "acme", UsageRow.WHATSAPP_CALL, true, "p1",
                "wa-old", null, DRIVER, UsageRow.WHATSAPP_CALL, UsageRow.CONFIRMED, NOW.minusSeconds(600), 60, 1,
                null, null, UsageRow.SOURCE_WEBHOOK, NOW.minusSeconds(600), NOW.minusSeconds(540), NOW));
        WhatsAppCalls whatsApp = whatsApp();
        events(whatsApp).apply("p1", event("call.initiated", Map.of("direction", "incoming", "connection_id", APP,
                "from", DRIVER, "call_control_id", "wa-in-6")));
        assertEquals("acme", calls.inboundByCallControl("wa-in-6").orElseThrow().tenantCode());
    }

    @Test
    void whatsAppMinutesArePricedByThePlanAndCallsFromContactsAreFreeOnMetasSide() {
        usage.setPlan(new Plan(100, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE, new BigDecimal("0.20"),
                BigDecimal.ZERO, false, null, null), "owner");
        usage.insert(new UsageRow("00000000-0000-0000-0000-000000000002", "acme", UsageRow.WHATSAPP_CALL, true, "p1",
                "wa-1", null, DRIVER, UsageRow.WHATSAPP_CALL, UsageRow.CONFIRMED, NOW, 90, 2, null, null,
                UsageRow.SOURCE_WEBHOOK, NOW, NOW.plusSeconds(90), NOW));
        usage.insert(new UsageRow("00000000-0000-0000-0000-000000000003", "acme", UsageRow.WHATSAPP_CALL, true, "p1",
                "wa-2", null, DRIVER, UsageRow.WHATSAPP_INBOUND, UsageRow.CONFIRMED, NOW, 30, 1, null, null,
                UsageRow.SOURCE_WEBHOOK, NOW, NOW.plusSeconds(30), NOW));

        var lines = plan.usage("acme", YearMonth.from(NOW.atZone(ZoneOffset.UTC)));
        Line outbound = lines.lines().stream().filter(l -> UsageRow.WHATSAPP_CALL.equals(l.destinationType()))
                .findFirst().orElseThrow();
        Line inbound = lines.lines().stream().filter(l -> UsageRow.WHATSAPP_INBOUND.equals(l.destinationType()))
                .findFirst().orElseThrow();
        assertEquals(0, new BigDecimal("0.40").compareTo(outbound.chargeUsd()));
        assertEquals(1, inbound.billedMinutes());
        assertEquals(0, BigDecimal.ZERO.compareTo(inbound.chargeUsd()));
        assertEquals(0, lines.usedMinutes(), "WhatsApp minutes are not taken from the voice quota");
    }

    @Test
    void readsTheCallerFromMetasSipAddress() {
        assertEquals(DRIVER, WhatsAppCalls.callerE164("sip:+56911111111@wa.meta.vc;transport=tls"));
        assertEquals(DRIVER, WhatsAppCalls.callerE164("56911111111"));
        assertNull(WhatsAppCalls.callerE164("anonymous"));
        assertFalse(config.toString().contains("placeholder-secret"));
    }

    private static final class MutableClock extends Clock {
        Instant at;

        MutableClock(Instant at) {
            this.at = at;
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return at;
        }
    }
}

package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Plan;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class TelnyxParkedCallsTest {
    private static final Instant NOW = Instant.parse("2026-11-04T10:00:00Z");
    private final ObjectMapper json = new ObjectMapper();
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final InMemoryTelephonyUsageStore usage = new InMemoryTelephonyUsageStore();
    private final StubHttp http = new StubHttp().reply("POST /v2/calls", 200, "{}");
    private final IntegrationConnection connection = new IntegrationConnection("p1", PlatformScope.TENANT, "Line",
            ProviderType.TELNYX, URI.create("https://api.telnyx.test"), "cred", ConnectionStatus.ACTIVE,
            null, null, Map.of("sipConnectionId", "sip-1", "callerNumber", "+56220000000", "channelLimit", 1));
    private final TelnyxParkedCalls admission = new TelnyxParkedCalls(id -> connection,
            (t, c) -> new ResolvedConnection(c.id(), c.baseUrl(), c.metadata(), Map.of("token", "KEY_test")), usage,
            new TelephonyPlanService(usage, clock), new TelnyxClient(http, connection.baseUrl()), clock);
    private final TelnyxCallEvents events = new TelnyxCallEvents(usage, new InboundRouter(usage), json, clock, admission);

    private String reserve() {
        String ref = UUID.randomUUID().toString();
        usage.insert(new UsageRow(ref, "acme", UsageRow.VOICE, true, "p1", null, "case-1", "+56911111111",
                TelephonyPlanDtos.CL_MOBILE, UsageRow.STARTED, null, null, null, null, null, null, NOW, null, null));
        return ref;
    }

    private String event(String type, String state, String callId) {
        return "{\"data\":{\"event_type\":\"" + type + "\",\"occurred_at\":\"" + NOW + "\",\"payload\":{"
                + "\"direction\":\"outgoing\",\"state\":\"parked\",\"to\":\"+51999999999\",\"call_control_id\":\""
                + callId + "\",\"client_state\":\"" + Base64.getEncoder().encodeToString(state.getBytes(StandardCharsets.UTF_8)) + "\"}}}";
    }

    @Test
    void aReusedJwtCannotPlaceAnAdditionalOrConcurrentCall() throws Exception {
        String ref = reserve();
        events.apply("p1", event("call.initiated", ref, "sdk-1"));
        assertTrue(http.last().path().endsWith("/sdk-1/actions/transfer"));
        var transfer = json.readTree(http.last().body());
        assertEquals("+56911111111", transfer.path("to").asText(), "the reservation, not the SDK, chooses the destination");
        assertEquals(ref, transfer.path("command_id").asText());
        assertTrue(transfer.path("time_limit_secs").asInt() < IntegrationsTelephony.HOLD.toSeconds());
        assertNull(usage.find(ref).orElseThrow().externalId(), "the SDK leg is not billed as the callee");

        events.apply("p1", event("call.initiated", ref, "sdk-2"));
        assertTrue(http.last().path().endsWith("/sdk-2/actions/hangup"));
        events.apply("p1", event("call.initiated", "unknown-reservation", "sdk-3"));
        assertTrue(http.last().path().endsWith("/sdk-3/actions/hangup"));
        events.apply("p1", event("call.initiated", "pstn:" + UUID.randomUUID(), "sdk-4"));
        assertTrue(http.last().path().endsWith("/sdk-4/actions/hangup"), "browser-provided target state is not trusted");

        events.apply("p1", event("call.answered", ref, "sdk-1"));
        assertNull(usage.find(ref).orElseThrow().answeredAt(), "answering the browser leg is not answering the PSTN call");
        String target = "pstn:" + usage.admission(ref).orElseThrow().targetState();
        events.apply("p1", event("call.answered", target, "pstn-1"));
        assertEquals("pstn-1", usage.find(ref).orElseThrow().externalId());
        events.apply("p1", event("call.hangup", target, "pstn-1"));
        assertEquals(UsageRow.CONFIRMED, usage.find(ref).orElseThrow().status());
    }

    @Test
    void duplicateDeliveryRetriesTheSameProviderCommandAndKeepsItsPrivateState() {
        String ref = reserve();
        events.apply("p1", event("call.initiated", ref, "sdk-1"));
        String body = http.last().body();
        events.apply("p1", event("call.initiated", ref, "sdk-1"));
        assertEquals(body, http.last().body());
        assertEquals(1, usage.busyChannels("p1", NOW.minusSeconds(1)));
    }

    @Test
    void aBrowserEndCannotReleaseAnAdmittedCall() {
        String ref = reserve();
        events.apply("p1", event("call.initiated", ref, "sdk-1"));
        var telephony = new IntegrationsTelephony((t, p) -> null, null, null, usage, null, clock);
        telephony.callEnded("acme", ref, "fake-id");
        assertEquals(UsageRow.STARTED, usage.find(ref).orElseThrow().status());
        assertEquals(1, usage.busyChannels("p1", NOW.minusSeconds(1)));
    }

    @Test
    void admissionRechecksQuotaAndTheCurrentChannelLimit() {
        String ref = reserve();
        usage.setPlan(new Plan(0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, true, null, null), "owner");
        events.apply("p1", event("call.initiated", ref, "sdk-quota"));
        assertTrue(http.last().path().endsWith("/hangup"));
        assertTrue(usage.admission(ref).isEmpty());
        usage.setPlan(new Plan(0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, false, null, null), "owner");
        reserve();
        events.apply("p1", event("call.initiated", ref, "sdk-limit"));
        assertTrue(http.last().path().endsWith("/hangup"));
        assertTrue(usage.admission(ref).isEmpty());
    }

    @Test
    void onlyOneOfTwoConcurrentSdkLegsCanConsumeAReservation() throws Exception {
        String ref = reserve();
        CyclicBarrier barrier = new CyclicBarrier(2);
        try (var workers = Executors.newFixedThreadPool(2)) {
            var one = workers.submit(() -> { barrier.await(); return admission.handle("p1", "call.initiated", json.readTree(event("call.initiated", ref, "sdk-one")).path("data").path("payload")); });
            var two = workers.submit(() -> { barrier.await(); return admission.handle("p1", "call.initiated", json.readTree(event("call.initiated", ref, "sdk-two")).path("data").path("payload")); });
            one.get(10, TimeUnit.SECONDS);
            two.get(10, TimeUnit.SECONDS);
        }
        assertEquals(1, http.seen().stream().filter(r -> r.path().endsWith("/transfer")).count());
        assertEquals(1, http.seen().stream().filter(r -> r.path().endsWith("/hangup")).count());
    }

    @Test
    void anUncertainTransferRetainsTheBindingForAnIdempotentRetry() {
        String ref = reserve();
        http.failWith(new java.io.IOException("connection closed after request"));
        assertThrows(IllegalStateException.class, () -> events.apply("p1", event("call.initiated", ref, "sdk-1")));
        CallAdmission saved = usage.admission(ref).orElseThrow();
        String firstBody = http.last().body();
        http.failWith(null);
        events.apply("p1", event("call.initiated", ref, "sdk-1"));
        assertEquals(saved, usage.admission(ref).orElseThrow());
        assertEquals(firstBody, http.last().body());
        events.apply("p1", event("call.initiated", ref, "sdk-2"));
        assertTrue(http.last().path().endsWith("/hangup"));
    }

    @Test
    void expiredReservationsAndAnotherLinesReservationsCannotAuthorizeACall() {
        String ref = reserve();
        UsageRow row = usage.find(ref).orElseThrow();
        usage.update(row.providerData(null, row.calleeNumber(), NOW.minusSeconds(301), null, row.caseRef()));
        events.apply("p1", event("call.initiated", ref, "sdk-old"));
        assertTrue(http.last().path().endsWith("/hangup"));
        assertTrue(usage.admission(ref).isEmpty());
        events.apply("other-line", event("call.initiated", reserve(), "sdk-other"));
        assertTrue(http.last().path().endsWith("/hangup"));
    }
}

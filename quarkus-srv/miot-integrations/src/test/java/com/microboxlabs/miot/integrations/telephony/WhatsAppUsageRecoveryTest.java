package com.microboxlabs.miot.integrations.telephony;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class WhatsAppUsageRecoveryTest {
    private static final Instant NOW = Instant.parse("2026-11-09T10:00:00Z");
    private final InMemoryTelephonyUsageStore usage = new InMemoryTelephonyUsageStore();
    private final InMemoryWhatsAppCallStore calls = new InMemoryWhatsAppCallStore();
    private final StubHttp http = new StubHttp();
    private final WhatsAppSipConfig config = new WhatsAppSipConfig(
            new WhatsAppSipConfig.SipAccount("wa-app", "sip.example.test", "+12025550100", "test-user", "test-secret"),
            "DTLS", Duration.ofSeconds(45), "Test notice");
    private final WhatsAppUsageRecovery recovery = new WhatsAppUsageRecovery(usage, calls, config,
            new TelnyxClient(http, URI.create("https://api.telnyx.test")), new ObjectMapper());

    private void reserve(String destination) {
        usage.insert(new UsageRow("ref", "tenant-a", UsageRow.WHATSAPP_CALL, true, "managed", null, "case-1",
                "+12025550101", destination, UsageRow.EXPIRED, null, null, null, null, null, null,
                NOW.minusSeconds(8000), null, null));
        calls.saveLeg("ref", "wa-leg");
    }

    private String detailRecord(String leg, String app) {
        return """
                {"data":[{"call_control_id":"%s","connection_id":"%s","call_sec":61,
                "started_at":"2026-11-09T07:45:00Z","answered_at":"2026-11-09T07:45:10Z",
                "finished_at":"2026-11-09T07:46:11Z","cost":"0.01","currency":"USD"}]}
                """.formatted(leg, app);
    }

    @Test
    void recoversTheSavedWhatsAppLegOnceAndPreservesItsChannelAndContact() {
        reserve(UsageRow.WHATSAPP_CALL);
        http.reply("/v2/detail_records", 200, detailRecord("wa-leg", "wa-app"));
        assertEquals(1, recovery.recover("managed", "test-key", NOW));
        UsageRow row = usage.find("ref").orElseThrow();
        assertEquals(UsageRow.CONFIRMED, row.status());
        assertEquals(61, row.seconds());
        assertEquals(2, row.billedMinutes());
        assertEquals(UsageRow.WHATSAPP_CALL, row.channel());
        assertEquals("+12025550101", row.calleeNumber());
        assertEquals("case-1", row.caseRef());
        assertEquals(0, recovery.recover("managed", "test-key", NOW));
        assertEquals(1, usage.rows("tenant-a", NOW.minusSeconds(9000), NOW).size());
        assertEquals(0, usage.billedMinutes("tenant-a", NOW.minusSeconds(9000), NOW));
        assertTrue(http.last().request().uri().getQuery().contains("filter[record_type]=call-control"));
        new TelnyxCallEvents(usage, new InboundRouter(usage), new ObjectMapper()).apply("managed", """
                {"data":{"event_type":"call.hangup","occurred_at":"2026-11-09T09:00:00Z","payload":{
                "call_control_id":"wa-leg","client_state":"cmVm","end_time":"2026-11-09T09:00:00Z"}}}
                """);
        assertEquals(row, usage.find("ref").orElseThrow(), "a late webhook cannot change recovered billing");
    }

    @Test
    void rejectsOtherLegsAndApplicationsAndRetriesTransientFailures() {
        reserve(UsageRow.WHATSAPP_INBOUND);
        http.reply("/v2/detail_records", 200, detailRecord("operator-leg", "wa-app"));
        assertEquals(0, recovery.recover("managed", "test-key", NOW));
        http.reply("/v2/detail_records", 200, detailRecord("wa-leg", "other-app"));
        assertEquals(0, recovery.recover("managed", "test-key", NOW));
        http.reply("/v2/detail_records", 503, "{}");
        assertEquals(0, recovery.recover("managed", "test-key", NOW));
        http.reply("/v2/detail_records", 200, detailRecord("wa-leg", "wa-app"));
        assertEquals(0, recovery.recover("other-connection", "test-key", NOW));
        assertEquals(1, recovery.recover("managed", "test-key", NOW));
        assertEquals(UsageRow.WHATSAPP_INBOUND, usage.find("ref").orElseThrow().destinationType());
        assertEquals(UsageRow.SOURCE_DETAIL_RECORD, usage.find("ref").orElseThrow().source());
    }
}

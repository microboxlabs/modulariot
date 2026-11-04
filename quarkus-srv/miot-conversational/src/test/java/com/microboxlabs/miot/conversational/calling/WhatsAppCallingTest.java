package com.microboxlabs.miot.conversational.calling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.calling.CallRequestPolicy.Decision;
import com.microboxlabs.miot.conversational.calling.CallRequestPolicy.Grant;
import io.vertx.core.json.JsonObject;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class WhatsAppCallingTest {

    @Test
    void outOfRangeWebhookEpochsDoNotAbortTheDelivery() {
        JsonObject body = new JsonObject("""
                {"entry":[{"changes":[{"field":"calls","value":{
                  "calls":[{"timestamp":9223372036854775807},{"timestamp":"9223372036854775807"}]
                }}]}]}""");
        var events = WhatsAppCallEvents.calls(body);
        assertEquals(2, events.size());
        assertNull(events.get(0).at());
        assertNull(events.get(1).at());
    }

    private static final Instant NOW = Instant.parse("2026-11-04T12:00:00Z");

    @Test
    void offByDefault() {
        WhatsAppCallingSettings settings = new WhatsAppCallingSettings(false);
        assertFalse(settings.enabled());
        assertThrows(IllegalStateException.class, settings::requireEnabled);
    }

    @Test
    void aValidPermissionAllowsTheCall() {
        Grant temporary = new Grant(true, NOW.minus(Duration.ofDays(1)), NOW.plus(Duration.ofDays(6)));
        assertEquals(Decision.CALL, CallRequestPolicy.decide(List.of(), Optional.of(temporary), NOW).decision());
        Grant permanent = new Grant(true, NOW.minus(Duration.ofDays(30)), null);
        assertEquals(Decision.CALL, CallRequestPolicy.decide(List.of(), Optional.of(permanent), NOW).decision());
    }

    @Test
    void oneRequestPerDay() {
        Instant earlier = NOW.minus(Duration.ofHours(3));
        var outcome = CallRequestPolicy.decide(List.of(earlier), Optional.empty(), NOW);
        assertEquals(Decision.WAIT, outcome.decision());
        assertEquals(earlier.plus(Duration.ofHours(24)), outcome.nextRequestAt());
        assertEquals(Decision.REQUEST_PERMISSION,
                CallRequestPolicy.decide(List.of(NOW.minus(Duration.ofHours(25))), Optional.empty(), NOW)
                        .decision());
    }

    @Test
    void twoRequestsPerWeek() {
        Instant first = NOW.minus(Duration.ofDays(5));
        Instant second = NOW.minus(Duration.ofDays(2));
        var outcome = CallRequestPolicy.decide(List.of(second, first), Optional.empty(), NOW);
        assertEquals(Decision.WAIT, outcome.decision());
        assertEquals(first.plus(Duration.ofDays(7)), outcome.nextRequestAt());
    }

    @Test
    void anExpiredOrRejectedPermissionNeedsANewRequest() {
        Grant expired = new Grant(true, NOW.minus(Duration.ofDays(8)), NOW.minus(Duration.ofDays(1)));
        assertEquals(Decision.REQUEST_PERMISSION,
                CallRequestPolicy.decide(List.of(), Optional.of(expired), NOW).decision());
        Grant rejected = new Grant(false, NOW.minus(Duration.ofDays(1)), null);
        assertEquals(Decision.REQUEST_PERMISSION,
                CallRequestPolicy.decide(List.of(), Optional.of(rejected), NOW).decision());
    }

    @Test
    void theBodiesFollowTheCallingApi() {
        assertEquals("ENABLED", WhatsAppCallingRequests.enableCalling().getJsonObject("calling").getString("status"));
        JsonObject ask = WhatsAppCallingRequests.permissionRequest("56900000000", "¿Podemos llamarte?");
        assertEquals("call_permission_request", ask.getJsonObject("interactive").getString("type"));
        JsonObject connect = WhatsAppCallingRequests.connect("56900000000", "v=0\r\n");
        assertEquals("connect", connect.getString("action"));
        assertEquals("offer", connect.getJsonObject("session").getString("sdp_type"));
        assertThrows(IllegalArgumentException.class, () -> WhatsAppCallingRequests.connect("56900000000", " "));
        assertEquals("terminate", WhatsAppCallingRequests.terminate("wacid.1").getString("action"));
    }

    @Test
    void readsCallEventsAndPermissionReplies() {
        JsonObject calls = new JsonObject("""
                {"entry":[{"changes":[{"field":"calls","value":{
                  "metadata":{"phone_number_id":"pn-1"},
                  "calls":[
                    {"id":"wacid.1","event":"connect","from":"pn","to":"56900000000","timestamp":"1762257600",
                     "session":{"sdp_type":"answer","sdp":"v=0"}},
                    {"id":"wacid.1","event":"terminate","status":"COMPLETED","duration":42,"timestamp":1762257642}
                  ]}}]}]}""");
        var events = WhatsAppCallEvents.calls(calls);
        assertEquals(2, events.size());
        assertEquals("answer", events.get(0).sdpType());
        assertEquals(Instant.ofEpochSecond(1762257600), events.get(0).at());
        assertEquals(42, events.get(1).durationSeconds());
        assertEquals("pn-1", events.get(1).phoneNumberId());

        JsonObject replies = new JsonObject("""
                {"entry":[{"changes":[{"field":"messages","value":{
                  "metadata":{"phone_number_id":"pn-1"},
                  "messages":[
                    {"from":"56900000000","timestamp":"1762257600","type":"interactive","interactive":{
                      "type":"call_permission_reply","call_permission_reply":{
                        "response":"accept","is_permanent":false,"expiration_timestamp":1762862400}}},
                    {"from":"56900000000","type":"text","text":{"body":"hola"}}
                  ]}}]}]}""");
        var answers = WhatsAppCallEvents.permissionReplies(replies);
        assertEquals(1, answers.size());
        assertTrue(answers.get(0).accepted());
        assertFalse(answers.get(0).permanent());
        assertEquals(Instant.ofEpochSecond(1762862400), answers.get(0).expiresAt());
        assertTrue(WhatsAppCallEvents.calls(replies).isEmpty());
        assertTrue(WhatsAppCallEvents.calls(null).isEmpty());
    }
}

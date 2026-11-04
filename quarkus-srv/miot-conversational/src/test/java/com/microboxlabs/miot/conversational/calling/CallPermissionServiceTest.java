package com.microboxlabs.miot.conversational.calling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.calling.CallPermissionPolicy.Refusal;
import com.microboxlabs.miot.conversational.calling.CallPermissionPolicy.State;
import com.microboxlabs.miot.conversational.client.WhatsAppSendException;
import com.microboxlabs.miot.conversational.rules.ConvTemplate;
import com.microboxlabs.miot.conversational.service.CallPermissionReply;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService.SendingNumber;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CallPermissionServiceTest {

    private static final String TENANT = "tenant-a";
    private static final String PHONE = "+56 9 0000 0001";
    private static final String CONTACT = "+56900000001";
    private static final String NUMBER = "PNID";

    private record Sent(String to, String template, String language, Map<String, String> params) {
    }

    private final InMemoryCallPermissions store = new InMemoryCallPermissions();
    private final List<Sent> sent = new ArrayList<>();
    private Instant now = Instant.parse("2026-11-04T12:00:00Z");
    private boolean failSend;
    private boolean testModeBlocked;
    private boolean noConnection;
    private Optional<ConvTemplate> template = Optional.of(new ConvTemplate("t1", ConvTemplate.PLATFORM_TENANT,
            CallPermissionService.TEMPLATE_KEY, "Permiso", "Hola {{nombre}}",
            new ConvTemplate.WhatsApp("miot_call_permission_request", "es", List.of("nombre"), true), null, null,
            null, null, "0.1.0"));

    private CallPermissionService service(boolean enabled) {
        Clock clock = new Clock() {
            @Override
            public ZoneOffset getZone() {
                return ZoneOffset.UTC;
            }

            @Override
            public Clock withZone(java.time.ZoneId zone) {
                return this;
            }

            @Override
            public Instant instant() {
                return now;
            }
        };
        return new CallPermissionService(store, key -> template, (tenant, to) -> {
            if (noConnection || (testModeBlocked && to != null)) {
                throw new ConnectionResolutionException("No WhatsApp");
            }
            return new SendingNumber("_platform", URI.create("https://graph.example.test/v21.0"), NUMBER, "token");
        }, (tenantCode, number, to, name, language, params) -> {
            if (failSend) {
                throw new WhatsAppSendException("Meta said no", 400, null);
            }
            sent.add(new Sent(to, name, language, params));
            return "wamid." + sent.size();
        }, enabled, clock);
    }

    @Test
    void callsAndRepliesReplayChronologicallyAndRetriesDoNotCountAgain() {
        CallPermissionService service = service(true);
        service.applyReply(new CallPermissionReply(NUMBER, CONTACT, "grant", null, true, true, null,
                "user_action", now.minusSeconds(100).atOffset(ZoneOffset.UTC)));
        var newerMiss = new com.microboxlabs.miot.conversational.service.CallEvent(NUMBER, "miss-new", CONTACT,
                "terminate", "BUSINESS_INITIATED", "COMPLETED", false, now.minusSeconds(10).atOffset(ZoneOffset.UTC));
        service.applyCall(newerMiss);
        service.applyCall(newerMiss);
        service.applyCall(new com.microboxlabs.miot.conversational.service.CallEvent(NUMBER, "connected", CONTACT,
                "terminate", "BUSINESS_INITIATED", "COMPLETED", true, now.minusSeconds(20).atOffset(ZoneOffset.UTC)));
        service.applyCall(new com.microboxlabs.miot.conversational.service.CallEvent(NUMBER, "miss-old", CONTACT,
                "terminate", "BUSINESS_INITIATED", "COMPLETED", false, now.minusSeconds(30).atOffset(ZoneOffset.UTC)));
        assertEquals(1, store.find(NUMBER, CONTACT).orElseThrow().consecutiveUnanswered());
        // A newer grant resets the streak regardless of the order those jobs ran.
        service.applyReply(new CallPermissionReply(NUMBER, CONTACT, "new-grant", null, true, true, null,
                "user_action", now.minusSeconds(5).atOffset(ZoneOffset.UTC)));
        service.applyCall(newerMiss);
        assertEquals(0, store.find(NUMBER, CONTACT).orElseThrow().consecutiveUnanswered());
        assertEquals(CallPermissionStatus.PERMANENT, store.find(NUMBER, CONTACT).orElseThrow().status());
    }

    @Test
    void offByDefaultSendsNothing() {
        CallPermissionService.RequestResult result = service(false).request(TENANT, PHONE, "Ana", "op@example.test");

        assertFalse(result.sent());
        assertEquals(Refusal.CALLING_DISABLED, result.refusal());
        assertFalse(result.view().callingEnabled());
        assertTrue(sent.isEmpty());
        assertTrue(store.requests.isEmpty());
    }

    @Test
    void sendsTheTemplateAndRecordsTheRequest() {
        CallPermissionService.RequestResult result = service(true).request(TENANT, PHONE, "Ana", "op@example.test");

        assertTrue(result.sent());
        assertEquals(List.of(new Sent(CONTACT, "miot_call_permission_request", "es", Map.of("nombre", "Ana"))),
                sent);
        InMemoryCallPermissions.Request request = store.requests.get(0);
        assertEquals(NUMBER, request.number());
        assertEquals(CONTACT, request.contact());
        assertEquals(CallPermissionService.ORIGIN_MANUAL, request.origin());
        assertEquals("wamid.1", request.wamid());
        assertEquals(State.PENDING, result.view().state());
        assertEquals(Refusal.DAILY_LIMIT, result.view().refusal());
    }

    @Test
    void enforcesOnePerDayAndTwoPerWeek() {
        CallPermissionService service = service(true);
        assertTrue(service.request(TENANT, PHONE, null, null).sent());

        now = now.plus(Duration.ofHours(2));
        CallPermissionService.RequestResult sameDay = service.request(TENANT, PHONE, null, null);
        assertEquals(Refusal.DAILY_LIMIT, sameDay.refusal());
        assertEquals(Instant.parse("2026-11-05T12:00:00Z"), sameDay.nextRequestAt());

        now = now.plus(Duration.ofDays(1));
        assertTrue(service.request(TENANT, PHONE, null, null).sent());

        now = now.plus(Duration.ofDays(2));
        CallPermissionService.RequestResult third = service.request(TENANT, PHONE, null, null);
        assertEquals(Refusal.WEEKLY_LIMIT, third.refusal());
        assertEquals(Instant.parse("2026-11-11T12:00:00Z"), third.nextRequestAt());
        assertEquals(2, sent.size());
        assertEquals(Map.of("nombre", "conductor"), sent.get(0).params());
    }

    @Test
    void aGrantedContactIsNotAskedAgain() {
        CallPermissionService service = service(true);
        service.applyReply(new CallPermissionReply(NUMBER, CONTACT, "wamid.R", null, true, true, null,
                "user_action", now.atOffset(ZoneOffset.UTC)));

        CallPermissionService.View view = service.view(TENANT, PHONE);
        assertEquals(State.CAN_CALL, view.state());
        assertEquals(CallPermissionStatus.PERMANENT, view.permission());
        assertEquals(Refusal.ALREADY_GRANTED, service.request(TENANT, PHONE, null, null).refusal());
        assertTrue(sent.isEmpty());
    }

    @Test
    void refusalsAreResultsNotExceptions() {
        CallPermissionService service = service(true);
        assertEquals(Refusal.INVALID_PHONE, service.request(TENANT, "123", null, null).refusal());

        noConnection = true;
        assertEquals(Refusal.NO_CONNECTION, service.request(TENANT, PHONE, null, null).refusal());
        assertEquals(Refusal.NO_CONNECTION, service.view(TENANT, PHONE).refusal());
        noConnection = false;

        template = Optional.empty();
        assertEquals(Refusal.NO_TEMPLATE, service.request(TENANT, PHONE, null, null).refusal());
        template = Optional.of(new ConvTemplate("t1", ConvTemplate.PLATFORM_TENANT,
                CallPermissionService.TEMPLATE_KEY, "Permiso", "x",
                new ConvTemplate.WhatsApp("miot_call_permission_request", null, List.of(), true), null, null, null,
                null, "0.1.0"));

        failSend = true;
        CallPermissionService.RequestResult failed = service.request(TENANT, PHONE, null, null);
        assertEquals(Refusal.SEND_FAILED, failed.refusal());
        assertEquals("Meta said no", failed.detail());
        assertTrue(store.requests.isEmpty());
    }

    @Test
    void theRuleRecordsWhatItSent() {
        CallPermissionService service = service(true);
        CallPermissionService.Admission admission = service.admit(TENANT, PHONE);
        assertTrue(admission.admitted());
        assertNull(admission.refusal());

        service.recordSent(TENANT, admission, "wamid.rule");

        assertEquals(CallPermissionService.ORIGIN_RULE, store.requests.get(0).origin());
        assertEquals(Refusal.DAILY_LIMIT, service.admit(TENANT, PHONE).refusal());
        assertEquals("es", CallPermissionService.DEFAULT_LANGUAGE);
    }
    @Test
    void testModeRecipientsAreCheckedForBothStatusAndAdmission() {
        testModeBlocked = true;
        var service = service(true);
        assertFalse(service.view(TENANT, PHONE).canRequest());
        assertEquals(Refusal.NO_CONNECTION, service.view(TENANT, PHONE).refusal());
        assertEquals(Refusal.NO_CONNECTION, service.admit(TENANT, PHONE).refusal());
    }

    @Test
    void aReplyWithoutSourceTimeCannotOverrideANewerGrantOrRejection() {
        var service = service(true);
        service.applyReply(new CallPermissionReply(NUMBER, CONTACT, "new-grant", null, true, true, null,
                "user_action", now.atOffset(ZoneOffset.UTC)));
        service.applyReply(new CallPermissionReply(NUMBER, CONTACT, "untimed-denial", null, false, false, null,
                "user_action", null));
        assertEquals(CallPermissionStatus.PERMANENT, store.find(NUMBER, CONTACT).orElseThrow().status());
        service.applyReply(new CallPermissionReply(NUMBER, CONTACT, "new-denial", null, false, false, null,
                "user_action", now.plusSeconds(1).atOffset(ZoneOffset.UTC)));
        service.applyReply(new CallPermissionReply(NUMBER, CONTACT, "untimed-grant", null, true, true, null,
                "user_action", null));
        assertEquals(CallPermissionStatus.REVOKED, store.find(NUMBER, CONTACT).orElseThrow().status());
    }

    @Test
    void failedReceiptWritesAndUnknownSendOutcomesDoNotAllowAnotherManualSend() {
        var durable = new InMemoryCallPermissions() {
            @Override public void completeRequest(java.util.UUID id, String wamid, Instant at) {
                throw new IllegalStateException("Synthetic receipt write outage");
            }
        };
        java.util.concurrent.atomic.AtomicInteger attempts = new java.util.concurrent.atomic.AtomicInteger();
        var number = new SendingNumber("_platform", URI.create("https://graph.example.test"), NUMBER, "token");
        var service = new CallPermissionService(durable, key -> template, (tenant, to) -> number,
                (tenant, from, to, name, language, params) -> { attempts.incrementAndGet(); return "wamid.once"; },
                true, Clock.fixed(now, ZoneOffset.UTC));
        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                () -> service.request(TENANT, PHONE, null, null));
        assertEquals(1, attempts.get());
        assertEquals(Refusal.DAILY_LIMIT, service.request(TENANT, PHONE, null, null).refusal());
        assertEquals(1, attempts.get());
        assertEquals(1, durable.requests.size());
        // A new service instance sees the committed admission too; no in-memory receipt is required.
        var restarted = new CallPermissionService(durable, key -> template, (tenant, to) -> number,
                (tenant, from, to, name, language, params) -> { attempts.incrementAndGet(); return "wamid.twice"; },
                true, Clock.fixed(now, ZoneOffset.UTC));
        assertEquals(Refusal.DAILY_LIMIT, restarted.request(TENANT, PHONE, null, null).refusal());
        assertEquals(1, attempts.get());
        var uncertain = new CallPermissionService(store, key -> template, (tenant, to) -> number,
                (tenant, from, to, name, language, params) -> { throw new WhatsAppSendException("Timeout", null, null); },
                true, Clock.fixed(now, ZoneOffset.UTC));
        assertEquals(Refusal.SEND_FAILED, uncertain.request(TENANT, PHONE, null, null).refusal());
        assertEquals(Refusal.DAILY_LIMIT, uncertain.request(TENANT, PHONE, null, null).refusal());
    }

    @Test
    void aCallWithoutSourceTimeCannotEraseANewerMiss() {
        var service = service(true);
        service.applyReply(new CallPermissionReply(NUMBER, CONTACT, "grant", null, true, true, null,
                "user_action", now.minusSeconds(30).atOffset(ZoneOffset.UTC)));
        service.applyCall(new com.microboxlabs.miot.conversational.service.CallEvent(NUMBER, "miss", CONTACT,
                "terminate", "BUSINESS_INITIATED", "COMPLETED", false, now.minusSeconds(10).atOffset(ZoneOffset.UTC)));
        service.applyCall(new com.microboxlabs.miot.conversational.service.CallEvent(NUMBER, "untimed-connected", CONTACT,
                "terminate", "BUSINESS_INITIATED", "COMPLETED", true, null));
        assertEquals(1, store.find(NUMBER, CONTACT).orElseThrow().consecutiveUnanswered());
        assertNull(store.find(NUMBER, CONTACT).orElseThrow().lastConnectedCallAt());
    }

}

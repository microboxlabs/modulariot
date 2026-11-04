package com.microboxlabs.miot.conversational.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.calling.CallPermission;
import com.microboxlabs.miot.conversational.calling.CallPermissionStatus;
import com.microboxlabs.miot.conversational.calling.CallPermissionPolicy;
import com.microboxlabs.miot.conversational.calling.CallPermissionService;
import com.microboxlabs.miot.conversational.calling.InMemoryCallPermissions;
import com.microboxlabs.miot.conversational.domain.MessageType;
import com.microboxlabs.miot.conversational.service.CallEvent;
import com.microboxlabs.miot.conversational.service.CallPermissionReply;
import com.microboxlabs.miot.conversational.service.MetaWebhookParser;
import com.microboxlabs.miot.conversational.service.ParsedWebhook;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** Call permission replies and calls events, from the Meta webhook body to the stored permission. */
class WhatsAppCallingWebhookTest {

    private static final String ORG = "tenant-a";
    private static final byte[] REPLY = """
            {"entry":[{"changes":[{"field":"messages","value":{
             "metadata":{"phone_number_id":"PNID_ORG"},
             "messages":[{"from":"56900000001","id":"wamid.REPLY","timestamp":"1793793600","type":"interactive",
               "context":{"from":"56900000000","id":"wamid.REQUEST"},
               "interactive":{"type":"call_permission_reply","call_permission_reply":{
                 "response":"accept","is_permanent":false,"expiration_timestamp":"1794398400",
                 "response_source":"user_action"}}}]}}]}]}
            """.getBytes(StandardCharsets.UTF_8);
    private static final byte[] UNANSWERED = """
            {"entry":[{"changes":[{"field":"calls","value":{
             "metadata":{"phone_number_id":"PNID_ORG"},
             "calls":[{"id":"wacid.1","to":"56900000001","from":"56900000000","event":"terminate",
               "direction":"BUSINESS_INITIATED","timestamp":"1793800000","status":"COMPLETED"}]}}]}]}
            """.getBytes(StandardCharsets.UTF_8);
    private static final byte[] CONNECTED = """
            {"entry":[{"changes":[{"field":"calls","value":{
             "metadata":{"phone_number_id":"PNID_ORG"},
             "calls":[{"id":"wacid.2","to":"56900000001","from":"56900000000","event":"terminate",
               "direction":"BUSINESS_INITIATED","timestamp":"1793800500","status":"COMPLETED",
               "start_time":"1793800380","end_time":"1793800500","duration":120}]}}]}]}
            """.getBytes(StandardCharsets.UTF_8);

    private final List<AsyncJobSpec> enqueued = new ArrayList<>();
    private final List<String> tenants = new ArrayList<>();
    private final WhatsAppWebhookJobs jobs = new WhatsAppWebhookJobs(this::enqueue, r -> { },
            pnid -> "PNID_ORG".equals(pnid) ? ORG : null, wamid -> null);
    private final InMemoryCallPermissions store = new InMemoryCallPermissions();
    private final CallPermissionService service = new CallPermissionService(store, key -> Optional.empty(),
            (tenant, to) -> null, (n, to, name, language, params) -> null, false,
            Clock.fixed(Instant.parse("2026-11-04T12:00:00Z"), ZoneOffset.UTC));

    private EnqueueJobsResponse enqueue(String tenant, EnqueueJobsRequest request) {
        tenants.add(tenant);
        enqueued.addAll(request.jobs());
        return new EnqueueJobsResponse(new ArrayList<>(request.jobs().stream().map(j -> (com.microboxlabs.miot
                .integrations.domain.AsyncJob) null).toList()), 0);
    }

    @Test
    void parsesTheReplyAndKeepsItInTheConversation() {
        ParsedWebhook parsed = MetaWebhookParser.parse(REPLY);

        CallPermissionReply reply = parsed.callPermissionReplies().get(0);
        assertEquals("PNID_ORG", reply.phoneNumberId());
        assertEquals("+56900000001", reply.contactE164());
        assertEquals("wamid.REQUEST", reply.contextMessageId());
        assertTrue(reply.accepted());
        assertFalse(reply.permanent());
        assertEquals(Instant.ofEpochSecond(1794398400L), reply.expiresAt().toInstant());
        assertEquals("user_action", reply.responseSource());

        assertEquals(MessageType.TEXT, parsed.messages().get(0).type());
        assertEquals("Permiso de llamada aceptado (temporal)", parsed.messages().get(0).body());
    }

    @Test
    void parsesCallEvents() {
        CallEvent unanswered = MetaWebhookParser.parse(UNANSWERED).calls().get(0);
        assertEquals("+56900000001", unanswered.contactE164());
        assertTrue(unanswered.terminated());
        assertTrue(unanswered.businessInitiated());
        assertFalse(unanswered.connected());

        assertTrue(MetaWebhookParser.parse(CONNECTED).calls().get(0).connected());
    }

    @Test
    void replyAndCallsReachThePermissionThroughTheirJobs() {
        jobs.enqueue(REPLY, ORG);
        jobs.enqueue(UNANSWERED, ORG);
        jobs.enqueue(CONNECTED, ORG);

        assertEquals(List.of(WhatsAppWebhookJobs.MESSAGE_JOB, WhatsAppWebhookJobs.CALL_PERMISSION_JOB,
                WhatsAppWebhookJobs.CALL_JOB, WhatsAppWebhookJobs.CALL_JOB),
                enqueued.stream().map(AsyncJobSpec::jobType).toList());
        assertEquals(List.of(ORG, ORG, ORG), tenants);
        assertEquals("wa:callperm:wamid.REPLY", enqueued.get(1).dedupeKey());
        assertEquals("wa:call:wacid.1:terminate", enqueued.get(2).dedupeKey());

        WhatsAppCallPermissionReplyJob replyJob = new WhatsAppCallPermissionReplyJob(service);
        WhatsAppCallEventJob callJob = new WhatsAppCallEventJob(service);
        replyJob.handle(ORG, enqueued.get(1).payload());
        callJob.handle(ORG, enqueued.get(2).payload());

        CallPermission afterMiss = store.find("PNID_ORG", "+56900000001").orElseThrow();
        assertEquals(CallPermissionStatus.TEMPORARY, afterMiss.status());
        assertEquals(1, afterMiss.consecutiveUnanswered());

        callJob.handle(ORG, enqueued.get(3).payload());
        CallPermission afterAnswer = store.find("PNID_ORG", "+56900000001").orElseThrow();
        assertEquals(0, afterAnswer.consecutiveUnanswered());
        assertEquals(Instant.ofEpochSecond(1793800500L), afterAnswer.lastConnectedCallAt());
        assertTrue(afterAnswer.active(Instant.ofEpochSecond(1793800500L)));
        assertEquals(4, CallPermissionPolicy.UNANSWERED_REVOKE);
    }
}

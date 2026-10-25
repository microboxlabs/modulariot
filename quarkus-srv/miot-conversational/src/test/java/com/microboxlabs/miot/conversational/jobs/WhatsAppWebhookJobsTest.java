package com.microboxlabs.miot.conversational.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import com.microboxlabs.miot.conversational.events.ConversationReplyReceived;
import com.microboxlabs.miot.conversational.service.InboundMessage;
import com.microboxlabs.miot.conversational.service.StatusUpdate;
import com.microboxlabs.miot.conversational.service.WhatsAppInboundService.Ingested;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The Meta webhook as integration jobs: one per event, on the right tenant, and the handlers' outcomes. */
class WhatsAppWebhookJobsTest {

    private static final String ORG = "tenant-a";
    private static final byte[] DELIVERY = """
            {"entry":[{"changes":[{"value":{
             "metadata":{"phone_number_id":"PNID_ORG"},
             "contacts":[{"profile":{"name":"Ana"},"wa_id":"56900000001"}],
             "messages":[{"from":"56900000001","id":"wamid.IN1","timestamp":"1719792000","type":"text",
                          "text":{"body":"Estoy bien"}}],
             "statuses":[{"id":"wamid.OUT1","status":"read","timestamp":"1719792200","recipient_id":"56900000001"},
                         {"id":"wamid.GONE","status":"delivered","timestamp":"1719792200",
                          "recipient_id":"56900000001"}]}}]},
             {"changes":[{"value":{"metadata":{"phone_number_id":"PNID_UNKNOWN"},
             "messages":[{"from":"56900000002","id":"wamid.IN2","timestamp":"1719792000","type":"text",
                          "text":{"body":"hola"}}]}}]}]}
            """.getBytes(StandardCharsets.UTF_8);

    private final Map<String, List<AsyncJobSpec>> enqueued = new LinkedHashMap<>();
    private final List<String> enqueuedBy = new ArrayList<>();
    private final List<EnqueueJobsResponse> kicked = new ArrayList<>();
    private final WhatsAppWebhookJobs jobs = new WhatsAppWebhookJobs(this::enqueue, kicked::add,
            pnid -> "PNID_ORG".equals(pnid) ? ORG : null,
            wamid -> "wamid.OUT1".equals(wamid) ? ORG : null);

    private EnqueueJobsResponse enqueue(String tenant, EnqueueJobsRequest request) {
        enqueued.put(tenant, request.jobs());
        enqueuedBy.add(request.enqueuedBy());
        List<AsyncJob> created = new ArrayList<>();
        request.jobs().forEach(j -> created.add(null));
        return new EnqueueJobsResponse(created, 0);
    }

    @Test
    void eachEventIsAJobOfTheOrganizationItBelongsTo() {
        assertEquals(4, jobs.enqueue(DELIVERY, PlatformScope.TENANT));

        List<AsyncJobSpec> org = enqueued.get(ORG);
        assertEquals(List.of(WhatsAppWebhookJobs.MESSAGE_JOB, WhatsAppWebhookJobs.STATUS_JOB),
                org.stream().map(AsyncJobSpec::jobType).toList());
        AsyncJobSpec message = org.get(0);
        assertEquals(ModulithJobHandler.EXECUTOR, message.executor());
        assertEquals("wa:msg:wamid.IN1", message.dedupeKey());
        assertEquals("wamid.IN1", message.correlationKey());
        assertEquals("Estoy bien", message.payload().get("body"));
        assertEquals("wa:status:wamid.OUT1:READ", org.get(1).dedupeKey());

        // The unknown number's message and the unknown wamid's status go to the platform scope.
        assertEquals(List.of("wa:msg:wamid.IN2", "wa:status:wamid.GONE:DELIVERED"),
                enqueued.get(PlatformScope.TENANT).stream().map(AsyncJobSpec::dedupeKey).toList());
        assertEquals(List.of("webhook", "webhook"), enqueuedBy);
        assertEquals(2, kicked.size());
    }

    @Test
    void anOrganizationsConnectionCarriesOnlyItsOwnEvents() {
        assertEquals(2, jobs.enqueue(DELIVERY, ORG));
        assertEquals(List.of(ORG), List.copyOf(enqueued.keySet()));

        enqueued.clear();
        assertEquals(0, jobs.enqueue(DELIVERY, "tenant-b"));
        assertTrue(enqueued.isEmpty());
    }

    @Test
    void aMessageJobRoundTripsItsPayloadAndHandsTheReplyOn() {
        jobs.enqueue(DELIVERY, PlatformScope.TENANT);
        Map<String, Object> payload = enqueued.get(ORG).get(0).payload();
        List<InboundMessage> stored = new ArrayList<>();
        List<ConversationReplyReceived> handed = new ArrayList<>();
        ConversationReplyReceived reply = new ConversationReplyReceived(ORG, "c1", "m1", null, "run-1", null,
                Channel.WHATSAPP, "+56900000001", "Estoy bien", null, OffsetDateTime.now());
        WhatsAppInboundMessageJob handler = new WhatsAppInboundMessageJob(m -> {
            stored.add(m);
            return new Ingested(reply, stored.size() > 1, null);
        }, handed::add, jobs::tenantOf);

        JobOutcome first = handler.handle(ORG, payload);
        JobOutcome retried = handler.handle(ORG, payload);

        InboundMessage m = stored.get(0);
        assertEquals("wamid.IN1", m.wamid());
        assertEquals("+56900000001", m.fromE164());
        assertEquals(MessageType.TEXT, m.type());
        assertEquals(1719792000L, m.timestamp().toEpochSecond());
        assertEquals(JobOutcome.SUCCEEDED, first.outcome());
        assertEquals(JobOutcome.SUCCEEDED, retried.outcome());
        assertTrue(retried.detail().startsWith("Already stored"));
        assertEquals(List.of(reply, reply), handed);
    }

    @Test
    void aMessageWithoutAConnectionIsSkippedWithItsReasonAndARuleFailureRetries() {
        WhatsAppInboundMessageJob unrouted = new WhatsAppInboundMessageJob(
                m -> new Ingested(null, false, "No active WhatsApp connection for phone_number_id PNID_UNKNOWN"),
                r -> {
                    throw new AssertionError("no reply to hand on");
                }, jobs::tenantOf);
        JobOutcome skipped = unrouted.handle(PlatformScope.TENANT, Map.of("wamid", "wamid.IN2"));
        assertEquals(JobOutcome.SKIPPED, skipped.outcome());
        assertTrue(skipped.detail().contains("PNID_UNKNOWN"));

        ConversationReplyReceived reply = new ConversationReplyReceived(ORG, "c1", "m1", null, null, null,
                Channel.WHATSAPP, "+56900000001", "x", null, OffsetDateTime.now());
        WhatsAppInboundMessageJob failing = new WhatsAppInboundMessageJob(m -> new Ingested(reply, false, null),
                r -> {
                    throw new IllegalStateException("rules down");
                }, jobs::tenantOf);
        Map<String, Object> mine = Map.of("wamid", "wamid.IN1", "phoneNumberId", "PNID_ORG");
        assertThrows(IllegalStateException.class, () -> failing.handle(ORG, mine));
    }

    @Test
    void anOrganizationsJobCannotCarryAnotherTenantsEvent() {
        jobs.enqueue(DELIVERY, PlatformScope.TENANT);
        List<InboundMessage> stored = new ArrayList<>();
        WhatsAppInboundMessageJob messages = new WhatsAppInboundMessageJob(m -> {
            stored.add(m);
            return new Ingested(null, false, "nothing");
        }, r -> {
        }, jobs::tenantOf);
        List<StatusUpdate> applied = new ArrayList<>();
        WhatsAppInboundStatusJob statuses = new WhatsAppInboundStatusJob(applied::add, jobs::tenantOf);

        JobOutcome message = messages.handle("tenant-b", enqueued.get(ORG).get(0).payload());
        JobOutcome status = statuses.handle("tenant-b", enqueued.get(ORG).get(1).payload());

        assertEquals(JobOutcome.SKIPPED, message.outcome());
        assertEquals(JobOutcome.SKIPPED, status.outcome());
        assertTrue(stored.isEmpty());
        assertTrue(applied.isEmpty());
        // The platform scope carries any event: a status waits there until its message is stored.
        messages.handle(PlatformScope.TENANT, enqueued.get(ORG).get(0).payload());
        assertEquals(1, stored.size());
    }

    @Test
    void theInboundJobTypesAreEnqueuedOnlyByTheModulith() {
        assertTrue(new WhatsAppInboundMessageJob(m -> null, r -> {
        }, jobs::tenantOf).internalOnly());
        assertTrue(new WhatsAppInboundStatusJob(s -> true, jobs::tenantOf).internalOnly());
    }

    @Test
    void aStatusBeforeItsMessageRetries() {
        jobs.enqueue(DELIVERY, PlatformScope.TENANT);
        List<StatusUpdate> applied = new ArrayList<>();
        WhatsAppInboundStatusJob handler = new WhatsAppInboundStatusJob(s -> {
            applied.add(s);
            return "wamid.OUT1".equals(s.wamid());
        }, jobs::tenantOf);

        JobOutcome read = handler.handle(ORG, enqueued.get(ORG).get(1).payload());
        assertEquals(JobOutcome.SUCCEEDED, read.outcome());
        assertEquals(MessageStatus.READ, applied.get(0).status());

        Map<String, Object> unknown = enqueued.get(PlatformScope.TENANT).get(1).payload();
        assertThrows(IllegalStateException.class, () -> handler.handle(PlatformScope.TENANT, unknown));
    }
}

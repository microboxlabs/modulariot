package com.microboxlabs.miot.conversational.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageRole;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService;
import com.microboxlabs.miot.integrations.jobs.JobFailureNotificationFeature;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Send policy for job_failure_notification: one WhatsApp per recipient, text
 * by default / template when configured, per-recipient failures collected —
 * all failed throws (ledger retries), partial succeeds with detail (a retry
 * would re-message the recipients that already got it). The send must never
 * carry a serviceCode: that would graft the ops recipient's message onto the
 * service's driver conversation thread.
 */
class JobFailureNotificationHandlerTest {

    private final FakeMessaging messaging = new FakeMessaging();
    private final JobFailureNotificationHandler handler = new JobFailureNotificationHandler(messaging);

    private static Map<String, Object> payload(List<String> recipients) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put(JobFailureNotificationFeature.PAYLOAD_TENANT_CODE, "tenant-1");
        p.put(JobFailureNotificationFeature.PAYLOAD_RECIPIENTS, recipients);
        p.put(JobFailureNotificationFeature.PAYLOAD_FAILED_JOB_ID, "job-1");
        p.put(JobFailureNotificationFeature.PAYLOAD_FAILED_JOB_TYPE, "alerce_assignment");
        p.put(JobFailureNotificationFeature.PAYLOAD_CORRELATION_KEY, "87920845");
        p.put(JobFailureNotificationFeature.PAYLOAD_ERROR, "CONDUCTOR2 NO EXISTE");
        return p;
    }

    @Test
    void sendsOneTextPerRecipientWithTheFailureContext() {
        var result = handler.handle("tenant-1", payload(List.of("+56911111111", "+56922222222")));

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertEquals(2, messaging.sent.size());
        assertEquals("tenant-1", messaging.tenants.get(0));
        SendWhatsAppMessageRequest first = messaging.sent.get(0);
        assertEquals("+56911111111", first.to());
        assertEquals("+56922222222", messaging.sent.get(1).to());
        assertTrue(first.body().contains("alerce_assignment"));
        assertTrue(first.body().contains("87920845"));
        assertTrue(first.body().contains("CONDUCTOR2 NO EXISTE"));
        // Never thread-graft onto the service's driver conversation.
        assertNull(first.serviceCode());
        assertTrue(result.detail().contains("2/2"));
    }

    @Test
    void templateNameSwitchesToATemplateSend() {
        Map<String, Object> p = payload(List.of("+56911111111"));
        p.put(JobFailureNotificationFeature.PAYLOAD_TEMPLATE_NAME, "job_failed_alert");
        p.put(JobFailureNotificationFeature.PAYLOAD_LANGUAGE, "es_CL");

        handler.handle("tenant-1", p);

        SendWhatsAppMessageRequest sent = messaging.sent.get(0);
        assertTrue(sent.isTemplate());
        assertEquals("job_failed_alert", sent.templateName());
        assertEquals("es_CL", sent.language());
        assertEquals("alerce_assignment", sent.templateParams().get("job_type"));
        assertEquals("87920845", sent.templateParams().get("correlation_key"));
        assertEquals("CONDUCTOR2 NO EXISTE", sent.templateParams().get("error"));
    }

    @Test
    void blankTemplateParamsFallBackToPlaceholders() {
        Map<String, Object> p = payload(List.of("+56911111111"));
        p.remove(JobFailureNotificationFeature.PAYLOAD_CORRELATION_KEY);
        p.remove(JobFailureNotificationFeature.PAYLOAD_ERROR);
        p.put(JobFailureNotificationFeature.PAYLOAD_TEMPLATE_NAME, "job_failed_alert");

        handler.handle("tenant-1", p);

        // The messaging service rejects blank param values — "-" keeps them valid.
        assertEquals("-", messaging.sent.get(0).templateParams().get("correlation_key"));
        assertEquals("-", messaging.sent.get(0).templateParams().get("error"));
    }

    @Test
    void allRecipientsFailedThrowsForRetry() {
        messaging.failAll = true;
        Map<String, Object> p = payload(List.of("+56911111111", "+56922222222"));

        assertThrows(IllegalStateException.class, () -> handler.handle("tenant-1", p));
    }

    @Test
    void partialFailureSucceedsWithTheFailuresInTheDetail() {
        messaging.failFirst = true;

        var result = handler.handle("tenant-1", payload(List.of("+56911111111", "+56922222222")));

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertTrue(result.detail().contains("1/2"));
        assertTrue(result.detail().contains("****1111"));
    }

    @Test
    void thrownSendErrorsCountAsRecipientFailures() {
        messaging.throwFirst = new IllegalArgumentException("not on the test-recipient list");

        var result = handler.handle("tenant-1", payload(List.of("+56911111111", "+56922222222")));

        assertEquals(JobOutcome.SUCCEEDED, result.outcome());
        assertTrue(result.detail().contains("not on the test-recipient list"));
    }

    @Test
    void missingTenantOrRecipientsIsANonRetryableArgumentError() {
        Map<String, Object> noTenant = payload(List.of("+56911111111"));
        noTenant.remove(JobFailureNotificationFeature.PAYLOAD_TENANT_CODE);
        assertThrows(IllegalArgumentException.class, () -> handler.handle("tenant-1", noTenant));

        Map<String, Object> noRecipients = payload(List.of());
        assertThrows(IllegalArgumentException.class, () -> handler.handle("tenant-1", noRecipients));
    }

    // -----------------------------------------------------------------------

    /** Records send requests and fabricates SENT/FAILED results without Meta. */
    private static class FakeMessaging extends WhatsAppMessagingService {
        final List<SendWhatsAppMessageRequest> sent = new ArrayList<>();
        final List<String> tenants = new ArrayList<>();
        boolean failAll;
        boolean failFirst;
        RuntimeException throwFirst;

        FakeMessaging() {
            super(null, null, null, null);
        }

        @Override
        public Message send(String tenantCode, SendWhatsAppMessageRequest request, String sentByUserId) {
            if (throwFirst != null && sent.isEmpty() && tenants.isEmpty()) {
                tenants.add(tenantCode);
                throw throwFirst;
            }
            boolean fail = failAll || (failFirst && sent.isEmpty());
            tenants.add(tenantCode);
            sent.add(request);
            return message(request, fail);
        }

        private static Message message(SendWhatsAppMessageRequest request, boolean failed) {
            return new Message(UUID.randomUUID().toString(), "conv-1", MessageDirection.OUTBOUND,
                    MessageRole.AGENT, request.isTemplate() ? MessageType.TEMPLATE : MessageType.TEXT,
                    request.body(), request.templateName(), null, null, null,
                    failed ? null : "wamid.test",
                    failed ? MessageStatus.FAILED : MessageStatus.SENT,
                    failed ? "Meta 400" : null,
                    "job-failure-notifier", null, null, Map.of(), null, null, null, null);
        }
    }
}

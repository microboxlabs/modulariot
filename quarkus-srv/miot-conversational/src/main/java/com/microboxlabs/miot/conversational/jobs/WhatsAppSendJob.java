package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.calling.CallPermissionPolicy;
import com.microboxlabs.miot.conversational.calling.CallPermissionService;
import com.microboxlabs.miot.conversational.calling.CallPermissionService.Admission;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.rules.SendJobs;
import com.microboxlabs.miot.conversational.rules.store.RunStore;
import com.microboxlabs.miot.conversational.service.SendFailure;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService;
import com.microboxlabs.miot.integrations.jobs.InternalJobTypes;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Sends a rule's PENDING WhatsApp message through Meta. A 5xx, a 429 or no answer retries with backoff; anything
 * a retry cannot fix, such as a missing connection or a number Meta refuses, parks the job at once.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class WhatsAppSendJob implements ModulithJobHandler {

    private final WhatsAppMessagingService whatsapp;
    private final RunStore runs;
    private final CallPermissionService callPermissions;

    /** Without call permissions: a call permission request is refused as if calling were off. */
    public WhatsAppSendJob(WhatsAppMessagingService whatsapp, RunStore runs) {
        this(whatsapp, runs, null);
    }

    @Inject
    public WhatsAppSendJob(WhatsAppMessagingService whatsapp, RunStore runs, CallPermissionService callPermissions) {
        this.whatsapp = whatsapp;
        this.runs = runs;
        this.callPermissions = callPermissions;
    }

    @Override
    public String jobType() {
        return InternalJobTypes.WHATSAPP_SEND;
    }

    /** Only the rules engine enqueues these. */
    @Override
    public boolean internalOnly() {
        return true;
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        if (SuppressedSend.cancel(runs, tenantCode, payload)) {
            return JobOutcome.skipped("Notification cancelled for an ignored or closed case");
        }
        String messageId = text(payload, SendJobs.MESSAGE_ID);
        try {
            Admission admission = null;
            if (SendJobs.callPermission(payload)) {
                Message queued = whatsapp.queuedMessage(tenantCode, messageId);
                if (queued.status() == MessageStatus.PENDING || queued.status() == MessageStatus.FAILED) {
                    admission = admit(tenantCode, queued.address());
                    if (!admission.admitted()) {
                        String reason = "Call permission request not sent: " + admission.refusal();
                        runs.failQueuedMessage(tenantCode, messageId, reason, Instant.now());
                        return JobOutcome.skipped(reason);
                    }
                }
            }
            Message sent = whatsapp.deliverQueued(tenantCode, messageId, text(payload, SendJobs.LANGUAGE),
                    params(payload == null ? null : payload.get(SendJobs.PARAMS)));
            if (admission != null && sent.status() == MessageStatus.SENT) {
                callPermissions.recordSent(tenantCode, admission, sent.providerMessageId());
            }
            return SendOutcome.of(sent);
        } catch (SendFailure e) {
            if (e.retryable()) {
                throw e;
            }
            throw new NonRetryableJobException(e.getMessage(), e);
        }
    }

    private Admission admit(String tenantCode, String address) {
        return callPermissions == null
                ? new Admission(null, null, CallPermissionPolicy.Refusal.CALLING_DISABLED, null, null)
                : callPermissions.admit(tenantCode, address);
    }

    static String text(Map<String, Object> payload, String key) {
        Object value = payload == null ? null : payload.get(key);
        return value == null ? null : value.toString();
    }

    private static Map<String, String> params(Object value) {
        Map<String, String> out = new LinkedHashMap<>();
        if (value instanceof Map<?, ?> map) {
            map.forEach((k, v) -> out.put(String.valueOf(k), v == null ? null : v.toString()));
        }
        return out;
    }
}

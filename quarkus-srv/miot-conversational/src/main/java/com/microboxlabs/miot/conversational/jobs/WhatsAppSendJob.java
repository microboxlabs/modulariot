package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.rules.SendJobs;
import com.microboxlabs.miot.conversational.service.SendFailure;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService;
import com.microboxlabs.miot.integrations.jobs.InternalJobTypes;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
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

    @Inject
    public WhatsAppSendJob(WhatsAppMessagingService whatsapp) {
        this.whatsapp = whatsapp;
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
        String messageId = text(payload, SendJobs.MESSAGE_ID);
        try {
            Message sent = whatsapp.deliverQueued(tenantCode, messageId, text(payload, SendJobs.LANGUAGE),
                    params(payload.get(SendJobs.PARAMS)));
            return SendOutcome.of(sent);
        } catch (SendFailure e) {
            if (e.retryable()) {
                throw e;
            }
            throw new NonRetryableJobException(e.getMessage(), e);
        }
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

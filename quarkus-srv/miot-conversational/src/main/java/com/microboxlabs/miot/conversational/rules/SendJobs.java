package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.service.ContextMessage;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.jobs.InternalJobTypes;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The job that sends one PENDING message of a run, on the modulith lane: {@value InternalJobTypes#WHATSAPP_SEND} or
 * {@value InternalJobTypes#EMAIL_SEND}. Its correlation key is the run, its dedupe key the message.
 */
public final class SendJobs {

    public static final String MESSAGE_ID = "messageId";
    public static final String RUN_ID = "runId";
    public static final String LANGUAGE = "language";
    public static final String PARAMS = "params";
    /** The template carries a call permission request: the send job checks Meta's limits first. */
    public static final String CALL_PERMISSION = "callPermission";

    private SendJobs() {
    }

    /** {@code message} carries the Meta template's language and parameters, which the stored message does not. */
    public static AsyncJobSpec whatsapp(Message queued, ContextMessage message) {
        return whatsapp(queued, message, false);
    }

    /** {@code callPermission}: the template carries a call permission request. */
    public static AsyncJobSpec whatsapp(Message queued, ContextMessage message, boolean callPermission) {
        Map<String, Object> payload = payload(queued);
        payload.put(LANGUAGE, message.language());
        payload.put(PARAMS, message.params());
        if (callPermission) {
            payload.put(CALL_PERMISSION, true);
        }
        return spec(InternalJobTypes.WHATSAPP_SEND, queued, payload);
    }

    public static boolean callPermission(Map<String, Object> payload) {
        Object value = payload == null ? null : payload.get(CALL_PERMISSION);
        return value != null && "true".equalsIgnoreCase(value.toString());
    }

    public static AsyncJobSpec email(Message queued) {
        return spec(InternalJobTypes.EMAIL_SEND, queued, payload(queued));
    }

    private static Map<String, Object> payload(Message queued) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(MESSAGE_ID, queued.id());
        payload.put(RUN_ID, queued.runId());
        return payload;
    }

    private static AsyncJobSpec spec(String jobType, Message queued, Map<String, Object> payload) {
        return new AsyncJobSpec(jobType, ModulithJobHandler.EXECUTOR, queued.runId(), null, 0,
                "conv:send:" + queued.id(), payload, null);
    }
}

package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import java.util.LinkedHashMap;
import java.util.Map;

/** A send job's outcome: the message's status and provider id, kept on the job. */
final class SendOutcome {

    private SendOutcome() {
    }

    static JobOutcome of(Message message) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("messageId", message.id());
        result.put("status", message.status().name());
        result.put("providerMessageId", message.providerMessageId());
        if (message.status() == MessageStatus.SENT) {
            return JobOutcome.succeeded("Sent to " + message.address(), result);
        }
        return new JobOutcome(JobOutcome.SKIPPED, "Already " + message.status().name(), result);
    }
}

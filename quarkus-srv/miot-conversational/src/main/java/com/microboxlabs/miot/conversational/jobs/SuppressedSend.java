package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.rules.Run;
import com.microboxlabs.miot.conversational.rules.SendJobs;
import com.microboxlabs.miot.conversational.rules.store.RunStore;
import java.time.Instant;
import java.util.Map;

/** A queued send is cancelled when its case was ignored, even if its run already finished. */
final class SuppressedSend {
    private SuppressedSend() { }

    static boolean cancel(RunStore runs, String tenant, Map<String, Object> payload) {
        String id = WhatsAppSendJob.text(payload, SendJobs.RUN_ID);
        Run run = runs.find(id).filter(r -> r.tenantCode().equals(tenant)).orElse(null);
        if (run == null || (run.status() != Run.Status.CANCELLED && !runs.ignoredSince(run))) {
            return false;
        }
        runs.failQueuedMessage(tenant, WhatsAppSendJob.text(payload, SendJobs.MESSAGE_ID),
                "Notification cancelled: the case was ignored or closed", Instant.now());
        return true;
    }
}

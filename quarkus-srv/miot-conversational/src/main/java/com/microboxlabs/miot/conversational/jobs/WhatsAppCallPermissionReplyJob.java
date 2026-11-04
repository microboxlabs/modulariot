package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.calling.CallPermissionService;
import com.microboxlabs.miot.conversational.service.CallPermissionReply;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.function.Consumer;

/** A contact's answer to a call permission request, from the webhook. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class WhatsAppCallPermissionReplyJob implements ModulithJobHandler {

    private final Consumer<CallPermissionReply> apply;

    @Inject
    public WhatsAppCallPermissionReplyJob(CallPermissionService permissions) {
        this(permissions::applyReply);
    }

    WhatsAppCallPermissionReplyJob(Consumer<CallPermissionReply> apply) {
        this.apply = apply;
    }

    @Override
    public String jobType() {
        return WhatsAppWebhookJobs.CALL_PERMISSION_JOB;
    }

    @Override
    public boolean internalOnly() {
        return true;
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        CallPermissionReply reply = WhatsAppWebhookJobs.JSON.convertValue(payload, CallPermissionReply.class);
        apply.accept(reply);
        return JobOutcome.succeeded((reply.accepted() ? "accept" : "reject") + " from " + reply.wamid());
    }
}

package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.calling.CallPermissionService;
import com.microboxlabs.miot.conversational.service.CallEvent;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.function.Consumer;

/** A WhatsApp call's connect or terminate event from the webhook, applied to the stored call permission. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class WhatsAppCallEventJob implements ModulithJobHandler {

    private final Consumer<CallEvent> apply;

    @Inject
    public WhatsAppCallEventJob(CallPermissionService permissions) {
        this(permissions::applyCall);
    }

    WhatsAppCallEventJob(Consumer<CallEvent> apply) {
        this.apply = apply;
    }

    @Override
    public String jobType() {
        return WhatsAppWebhookJobs.CALL_JOB;
    }

    @Override
    public boolean internalOnly() {
        return true;
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        CallEvent call = WhatsAppWebhookJobs.JSON.convertValue(payload, CallEvent.class);
        apply.accept(call);
        return JobOutcome.succeeded(call.event() + " " + call.callId());
    }
}

package com.microboxlabs.miot.conversational.jobs;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.conversational.rules.ExternalEventType;
import com.microboxlabs.miot.conversational.rules.ExternalEvents;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;

/**
 * An external producer declares the event types it publishes to the organization's rules, replacing what its
 * source declared before:
 *
 * <pre>{@code
 * {"source": "erp", "contextKind": "service",
 *  "types": [{"type": "erp.order.shipped", "description": "...",
 *             "fields": [{"name": "orderCode", "label": "Pedido", "type": "string"}]}]}
 * }</pre>
 *
 * A declaration that is not valid parks the job; nothing is stored then. A producer enqueues it with a dedupe key
 * made of the declaration's hash, so an unchanged declaration adds no job.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class ConversationEventsDeclareJob implements ModulithJobHandler {

    public static final String JOB_TYPE = "conversation.events.declare";
    static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private final ExternalEvents events;

    @Inject
    public ConversationEventsDeclareJob(ExternalEvents events) {
        this.events = events;
    }

    @Override
    public String jobType() {
        return JOB_TYPE;
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        ExternalEvents.Declaration declaration;
        try {
            declaration = JSON.convertValue(payload, ExternalEvents.Declaration.class);
        } catch (IllegalArgumentException e) {
            throw new NonRetryableJobException("The payload is not a declaration: " + e.getMessage(), e);
        }
        try {
            List<ExternalEventType> declared = events.declare(tenantCode, declaration);
            return JobOutcome.succeeded(declared.size() + " event types of " + declaration.source(),
                    Map.of("types", declared.stream().map(ExternalEventType::type).toList()));
        } catch (IllegalArgumentException e) {
            throw new NonRetryableJobException(e.getMessage(), e);
        }
    }
}

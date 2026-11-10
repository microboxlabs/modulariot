package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.rules.ExternalEventType;
import com.microboxlabs.miot.conversational.rules.ExternalEvents;
import com.microboxlabs.miot.conversational.rules.Run;
import com.microboxlabs.miot.conversational.rules.RulesEngine;
import com.microboxlabs.miot.core.event.EventContext;
import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * An external producer publishes one event to the organization's rules, which start as for an in-process event:
 *
 * <pre>{@code
 * {"type": "erp.order.shipped", "key": "shipment-4521", "at": "2026-11-10T12:00:00Z",
 *  "context": {"kind": "service", "key": "4521"}, "data": {"orderCode": "4521"}}
 * }</pre>
 *
 * <ul>
 *   <li>{@code type} must be declared for the organization ({@link ConversationEventsDeclareJob}); an undeclared
 *       one retries, as its declaration may be on its way.</li>
 *   <li>{@code key} makes it idempotent: a second job with the same key is skipped. Without it every job is a new
 *       event.</li>
 *   <li>{@code at} defaults to now; {@code context.kind} to the declared one; {@code test} to false.</li>
 * </ul>
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class ConversationEventJob implements ModulithJobHandler {

    public static final String JOB_TYPE = "conversation.event";
    static final int MAX_KEY = 200;

    private final RulesEngine engine;
    private final ExternalEvents events;
    private final Clock clock;

    @Inject
    public ConversationEventJob(RulesEngine engine, ExternalEvents events) {
        this(engine, events, Clock.systemUTC());
    }

    public ConversationEventJob(RulesEngine engine, ExternalEvents events, Clock clock) {
        this.engine = engine;
        this.events = events;
        this.clock = clock;
    }

    @Override
    public String jobType() {
        return JOB_TYPE;
    }

    /** The job waits while the engine does not take events. */
    @Override
    public boolean isReady() {
        return engine.acceptsEvents();
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        String type = text(payload, "type");
        if (type == null) {
            throw new NonRetryableJobException("type is required");
        }
        ExternalEventType declared = events.find(tenantCode, type).orElseThrow(() -> new IllegalStateException(
                "The event type " + type + " is not declared for the organization"));
        String source = text(payload, "source");
        if (source != null && !source.equals(declared.source())) {
            throw new NonRetryableJobException("The event type " + type + " is declared by " + declared.source()
                    + ", not " + source);
        }
        String key = text(payload, "key");
        if (key != null && key.length() > MAX_KEY) {
            throw new NonRetryableJobException("key: up to " + MAX_KEY + " characters");
        }
        Map<?, ?> context = map(payload, "context");
        String kind = context == null || context.get("kind") == null ? declared.contextKind()
                : String.valueOf(context.get("kind"));
        String contextKey = context == null || context.get("key") == null ? null : String.valueOf(context.get("key"));
        Object data = payload.get("data");
        if (data != null && !(data instanceof Map)) {
            throw new NonRetryableJobException("data must be an object");
        }
        String eventId = key == null ? UUID.randomUUID().toString() : eventId(tenantCode, declared.source(), key);
        if (key != null && engine.event(eventId).isPresent()) {
            return JobOutcome.skipped("The event " + key + " was already accepted");
        }
        List<Run> runs = engine.accept(new OperationalEvent(type, declared.source(), tenantCode, at(payload),
                new EventContext(kind, contextKey), data == null ? Map.of() : data,
                Boolean.TRUE.equals(payload.get("test"))), eventId);
        return JobOutcome.succeeded(runs.size() + " rule runs started",
                Map.of("eventId", eventId, "runs", runs.stream().map(Run::id).toList()));
    }

    /** The stored event's id for a producer's key: the same key always gives the same id. */
    static String eventId(String tenantCode, String source, String key) {
        return UUID.nameUUIDFromBytes((JOB_TYPE + "\n" + tenantCode + "\n" + source + "\n" + key)
                .getBytes(StandardCharsets.UTF_8)).toString();
    }

    private Instant at(Map<String, Object> payload) {
        String at = text(payload, "at");
        if (at == null) {
            return clock.instant();
        }
        try {
            return Instant.parse(at);
        } catch (DateTimeParseException e) {
            throw new NonRetryableJobException("at is not an ISO-8601 instant: " + at, e);
        }
    }

    private static String text(Map<String, Object> payload, String field) {
        Object v = payload == null ? null : payload.get(field);
        return v == null || String.valueOf(v).isBlank() ? null : String.valueOf(v).trim();
    }

    private static Map<?, ?> map(Map<String, Object> payload, String field) {
        Object v = payload == null ? null : payload.get(field);
        if (v != null && !(v instanceof Map)) {
            throw new NonRetryableJobException(field + " must be an object");
        }
        return (Map<?, ?>) v;
    }
}

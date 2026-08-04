package com.microboxlabs.miot.integrations.jobs;

import com.microboxlabs.miot.integrations.dispatch.ChannelDispatcher;
import com.microboxlabs.miot.integrations.dispatch.ChannelDispatcherRegistry;
import com.microboxlabs.miot.integrations.dispatch.DispatchOutcome;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationEventBindingRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.service.EventBindingSelector;
import com.microboxlabs.miot.integrations.template.PayloadRenderException;
import com.microboxlabs.miot.integrations.template.PayloadRenderer;
import com.microboxlabs.miot.integrations.template.PayloadSchema;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;

/**
 * Delivers one bound event: load the binding, render its payload from the context snapshot,
 * hand it to the channel's dispatcher.
 *
 * <p>Two addressing modes. A producer that selected the binding at enqueue time names it
 * ({@code bindingId}); a producer outside this module — one that cannot read bindings —
 * names the <b>event</b> ({@code eventType} + optional scope) and the winning binding is
 * selected at execute time, exactly as the fetch path does. No armed binding for the event
 * is a skip, not a failure: rollout is flipping a row on.
 *
 * <p>Failure handling is the point of running here rather than inline. A partner being down
 * is thrown, so the ledger backs off and retries; a payload that cannot be built, or a partner
 * rejecting the request itself, is parked — retrying either would fail identically forever
 * while burning attempts that a genuinely transient failure needs.
 */
@ApplicationScoped
public class IntegrationEventDispatchHandler implements ModulithJobHandler {

    private final IntegrationEventBindingRepository bindingRepository;
    private final IntegrationConnectionRepository connectionRepository;
    private final IntegrationOperationRepository operationRepository;
    private final EventBindingSelector selector;
    private final ChannelDispatcherRegistry dispatchers;
    private final PayloadRenderer renderer;

    @Inject
    public IntegrationEventDispatchHandler(
            IntegrationEventBindingRepository bindingRepository,
            IntegrationConnectionRepository connectionRepository,
            IntegrationOperationRepository operationRepository,
            EventBindingSelector selector,
            ChannelDispatcherRegistry dispatchers,
            PayloadRenderer renderer) {
        this.bindingRepository = bindingRepository;
        this.connectionRepository = connectionRepository;
        this.operationRepository = operationRepository;
        this.selector = selector;
        this.dispatchers = dispatchers;
        this.renderer = renderer;
    }

    @Override
    public String jobType() {
        return EventDispatchFeature.JOB_TYPE;
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        // The intake path stamps the tenant into the payload; a producer outside this
        // module doesn't have to — the ledger row already knows whose job this is.
        String tenantClientId = string(payload, EventDispatchFeature.PAYLOAD_TENANT_CLIENT_ID);
        if (tenantClientId == null) {
            tenantClientId = tenantCode;
        }
        if (tenantClientId == null) {
            throw new NonRetryableJobException("Event dispatch payload is missing its tenant");
        }

        IntegrationEventBinding binding = resolveBinding(tenantClientId, payload);
        if (binding == null) {
            // Unbound, disarmed, or (event-addressed) never bound: the operator's decision
            // wins over the queued intent, and that is a skip rather than a failure.
            return JobOutcome.skipped("No armed binding to deliver this event through");
        }

        IntegrationConnection connection =
                connectionRepository.findByTenantAndId(tenantClientId, binding.connectionId());
        if (connection == null) {
            throw new NonRetryableJobException(
                    "Connection " + binding.connectionId() + " no longer exists");
        }

        Object body = renderBody(binding, contractFor(binding), contextOf(payload));
        ChannelDispatcher dispatcher = dispatchers.dispatcherFor(connection.providerType());


        DispatchOutcome outcome = dispatcher.dispatch(tenantClientId, binding, body);
        if (outcome.success()) {
            return JobOutcome.succeeded(outcome.detail());
        }
        if (outcome.retryable()) {
            // Thrown, not returned: the worker maps an exception to a backed-off retry.
            throw new IllegalStateException(outcome.detail());
        }
        throw new NonRetryableJobException(outcome.detail());
    }

    /**
     * The binding this job delivers through: by id when the enqueuer named one, else
     * selected by event + scope. A named binding that is gone or disabled, like an event
     * with nothing armed, resolves to null — the caller skips.
     */
    private IntegrationEventBinding resolveBinding(
            String tenantClientId, Map<String, Object> payload) {
        String bindingId = string(payload, EventDispatchFeature.PAYLOAD_BINDING_ID);
        if (bindingId != null) {
            IntegrationEventBinding binding =
                    bindingRepository.findActiveById(tenantClientId, bindingId);
            return binding == null || !binding.enabled() ? null : binding;
        }
        String eventType = string(payload, EventDispatchFeature.PAYLOAD_EVENT_TYPE);
        if (eventType == null) {
            throw new NonRetryableJobException(
                    "Event dispatch payload names neither a binding nor an event type");
        }
        return selector.select(
                tenantClientId,
                eventType,
                string(payload, EventDispatchFeature.PAYLOAD_SCOPE_KIND),
                string(payload, EventDispatchFeature.PAYLOAD_SCOPE_KEY),
                contextOf(payload));
    }

    private PayloadSchema contractFor(IntegrationEventBinding binding) {
        if (binding.operationId() == null) {
            return PayloadSchema.empty();
        }
        IntegrationOperation operation = operationRepository.findByConnectionAndId(
                binding.connectionId(), binding.operationId());
        return operation == null ? PayloadSchema.empty() : PayloadSchema.of(operation.requestSchema());
    }

    private Object renderBody(
            IntegrationEventBinding binding, PayloadSchema contract, Map<String, Object> context) {
        try {
            return renderer.renderBody(
                    binding.fieldTemplates(), binding.fieldDefaults(), contract, context);
        } catch (PayloadRenderException e) {
            // The same binding and the same snapshot will fail identically forever.
            throw new NonRetryableJobException("Payload could not be built: " + e.getMessage());
        }
    }

    /**
     * The {@code {task, content, review, session}} snapshot captured at intake. Never re-read
     * from source: a retry must send the state that was reviewed, and {@code session} — the
     * reviewer — cannot be recovered on a worker thread that has no user.
     */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> contextOf(Map<String, Object> payload) {
        Object raw = payload.get(EventDispatchFeature.PAYLOAD_CONTEXT);
        return raw instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    private static String string(Map<String, Object> payload, String key) {
        Object value = payload == null ? null : payload.get(key);
        return value == null ? null : value.toString();
    }
}

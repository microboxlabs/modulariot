package com.microboxlabs.miot.integrations.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import com.microboxlabs.miot.integrations.persistence.IntegrationEventBindingRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.template.PayloadRenderException;
import com.microboxlabs.miot.integrations.template.PayloadRenderer;
import com.microboxlabs.miot.integrations.template.PayloadSchema;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jboss.logging.Logger;

/**
 * The fetch-shaped half of event bindings: where a dispatch <i>sends</i> a rendered payload
 * and drops the response, a fetch sends one and <b>uses</b> the response — rendered back
 * through the binding's {@code response_templates} into a map the caller merges.
 *
 * <p>This is what lets a job handler ask for data by <b>event name</b> instead of by
 * connection: which connection answers, with whose credential, and how fields map in both
 * directions are all operator-authored rows. The handler stays free of any client's
 * vocabulary.
 *
 * <p>Contract, in caller terms:
 * <ul>
 *   <li><b>Empty is "not configured", never an error.</b> No armed binding for the event,
 *       none matching the scope/condition, or a rendered request with nothing in it (the
 *       context lacked every mapped field) → {@link Optional#empty()}, and the caller
 *       proceeds exactly as before the binding existed. Rollout is flipping a row on.</li>
 *   <li><b>A configured fetch that cannot deliver fails closed.</b> Broken mapping, missing
 *       operation, rejected call — thrown, so the job retries or parks visibly rather than
 *       completing with silently missing data.</li>
 *   <li><b>The most specific binding wins.</b> A binding scoped to this exact scope beats an
 *       every-scope one; two at the same specificity is operator ambiguity and parks.</li>
 * </ul>
 */
@ApplicationScoped
public class EventBindingFetchService {

    private static final Logger LOG = Logger.getLogger(EventBindingFetchService.class);

    private final IntegrationEventBindingRepository bindingRepository;
    private final IntegrationOperationRepository operationRepository;
    private final IntegrationOperationInvoker invoker;
    private final PayloadRenderer renderer;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Inject
    public EventBindingFetchService(
            IntegrationEventBindingRepository bindingRepository,
            IntegrationOperationRepository operationRepository,
            IntegrationOperationInvoker invoker,
            PayloadRenderer renderer) {
        this.bindingRepository = bindingRepository;
        this.operationRepository = operationRepository;
        this.invoker = invoker;
        this.renderer = renderer;
    }

    /** A completed fetch: which binding answered, and the values to merge. */
    public record FetchedValues(String bindingId, String connectionId, Map<String, Object> values) {
    }

    /**
     * @param context what templates and the match condition read — for a job, its payload
     * @return the mapped response values, or empty when no binding is configured to answer
     */
    public Optional<FetchedValues> fetch(String tenantClientId, String eventType,
            String scopeKind, String scopeKey, Map<String, Object> context) {
        IntegrationEventBinding binding =
                selectBinding(tenantClientId, eventType, scopeKind, scopeKey, context);
        if (binding == null) {
            return Optional.empty();
        }

        Object request = renderRequest(binding, context);
        if (request instanceof Map<?, ?> map && map.isEmpty()) {
            // Every mapped field rendered empty — the context carries nothing to ask about.
            // The common case is a producer that has not been enriched to send the inputs
            // yet; treat it as unconfigured rather than calling the partner with nothing.
            LOG.debugf("Fetch binding %s for %s matched but the context has no mapped inputs — skipping",
                    binding.id(), eventType);
            return Optional.empty();
        }

        OperationInvocationResult response = invoke(binding, request);
        Map<String, Object> parsed = parseObject(binding, response.body());
        return Optional.of(new FetchedValues(binding.id(), binding.connectionId(),
                renderResponse(binding, parsed)));
    }

    /**
     * The armed bindings for the event, narrowed to scope and condition; scoped beats
     * every-scope, and a tie at the same specificity parks — for a fetch there is exactly
     * one truth, and guessing between two configured sources would silently pick one
     * tenant-visible behaviour over another.
     */
    private IntegrationEventBinding selectBinding(String tenantClientId, String eventType,
            String scopeKind, String scopeKey, Map<String, Object> context) {
        List<IntegrationEventBinding> matching =
                bindingRepository.listArmed(tenantClientId, eventType).stream()
                        .filter(binding -> binding.matchesScope(scopeKind, scopeKey))
                        .filter(binding -> EventConditionMatcher.matches(binding.matchCondition(), context))
                        .toList();
        if (matching.isEmpty()) {
            return null;
        }
        List<IntegrationEventBinding> scoped =
                matching.stream().filter(binding -> !binding.appliesToEveryScope()).toList();
        List<IntegrationEventBinding> candidates = scoped.isEmpty() ? matching : scoped;
        if (candidates.size() > 1) {
            throw new NonRetryableJobException("Event " + eventType + " has " + candidates.size()
                    + " bindings at the same specificity for scope " + scopeKind + "/" + scopeKey
                    + " — a fetch needs exactly one; disable the extras");
        }
        return candidates.get(0);
    }

    private Object renderRequest(IntegrationEventBinding binding, Map<String, Object> context) {
        if (binding.operationId() == null) {
            throw new NonRetryableJobException(
                    "Fetch binding " + binding.id() + " has no operation to call");
        }
        IntegrationOperation operation = operationRepository.findByConnectionAndId(
                binding.connectionId(), binding.operationId());
        if (operation == null) {
            throw new NonRetryableJobException("Operation " + binding.operationId()
                    + " no longer exists on connection " + binding.connectionId());
        }
        try {
            return renderer.renderBody(
                    binding.fieldTemplates(), PayloadSchema.of(operation.requestSchema()), context);
        } catch (PayloadRenderException e) {
            // The same binding over the same payload fails identically forever.
            throw new NonRetryableJobException(
                    "Fetch request could not be built: " + e.getMessage(), e);
        }
    }

    private OperationInvocationResult invoke(IntegrationEventBinding binding, Object request) {
        // OperationInvocationException (network, auth, SSRF) propagates as-is: retryable.
        OperationInvocationResult response = invoker.invoke(
                binding.tenantClientId(), binding.connectionId(), binding.operationId(), request);
        int status = response.status();
        if (status >= 200 && status < 300) {
            return response;
        }
        if (status >= 500 || status == 429) {
            // The partner may recover; the ledger backs off and retries.
            throw new IllegalStateException("Fetch rejected with " + status + ": " + excerpt(response.body()));
        }
        // 4xx: the same request meets the same rejection on every retry.
        throw new NonRetryableJobException(
                "Fetch rejected with " + status + ": " + excerpt(response.body()));
    }

    private Map<String, Object> parseObject(IntegrationEventBinding binding, String body) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(body, Map.class);
            return parsed;
        } catch (JsonProcessingException | RuntimeException e) {
            throw new NonRetryableJobException("Fetch response for binding " + binding.id()
                    + " is not a JSON object: " + excerpt(body), e);
        }
    }

    /**
     * The write-back. Rendered under root {@code response}, with the renderer's own
     * empty-is-omitted rule — a null slot in the response (no second driver) writes nothing
     * rather than a blank. No {@code response_templates} means the caller wants the response
     * as-is.
     */
    private Map<String, Object> renderResponse(
            IntegrationEventBinding binding, Map<String, Object> parsed) {
        if (binding.responseTemplates() == null || binding.responseTemplates().isEmpty()) {
            return parsed;
        }
        try {
            return renderer.render(
                    binding.responseTemplates(), PayloadSchema.empty(), Map.of("response", parsed));
        } catch (PayloadRenderException e) {
            throw new NonRetryableJobException(
                    "Fetch response mapping could not be applied: " + e.getMessage(), e);
        }
    }

    private static String excerpt(String body) {
        if (body == null) {
            return "(no body)";
        }
        String text = body.strip();
        return text.length() <= 200 ? text : text.substring(0, 200) + "…";
    }
}

package com.microboxlabs.miot.integrations.dispatch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.EventConditionMatcher;
import com.microboxlabs.miot.integrations.service.IntegrationOperationInvoker;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;

/**
 * The default channel: call the binding's operation over HTTP.
 *
 * <p>{@link #supports} returns <b>false</b> and the registry holds this as its explicit
 * fallback — the same idiom as {@code GenericConnectionTester}. Claiming every provider
 * instead would make it race channel-specific dispatchers on iteration order.
 *
 * <p>Being the default is deliberate: a partner API added tomorrow needs a connection and an
 * operation, not a new dispatcher.
 *
 * <p>Some partners answer HTTP 200 and put the verdict in the body. A binding with
 * {@code response_conditions} opts into body classification for 2xx responses: its
 * {@code success} matcher must hold for the dispatch to count as delivered, its {@code retry}
 * matcher marks the transient rejections, and anything else parks. Non-2xx statuses keep the
 * status-based rule regardless — a partner that failed at the HTTP layer never reaches body
 * interpretation.
 */
@ApplicationScoped
public class HttpOperationDispatcher implements ChannelDispatcher {

    public static final String CONDITION_SUCCESS = "success";
    public static final String CONDITION_RETRY = "retry";

    private final IntegrationOperationInvoker invoker;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Inject
    public HttpOperationDispatcher(IntegrationOperationInvoker invoker) {
        this.invoker = invoker;
    }

    /** Never claims a provider; {@link ChannelDispatcherRegistry} selects it explicitly. */
    @Override
    public boolean supports(ProviderType providerType) {
        return false;
    }

    @Override
    public DispatchOutcome dispatch(
            String tenantClientId, IntegrationEventBinding binding, Object payload) {
        OperationInvocationResult result = invoker.invoke(
                tenantClientId, binding.connectionId(), binding.operationId(), payload);

        if (result.successful()) {
            return classifyBody(binding, result);
        }
        // The partner's own status decides: 5xx/408/429 are "later", every other 4xx is
        // "never" and parking beats retrying a request it will keep rejecting.
        return result.retryable()
                ? DispatchOutcome.transientFailure(result.summary())
                : DispatchOutcome.permanentFailure(result.summary());
    }

    /** A 2xx answer, held to the binding's body conditions when it declares any. */
    private DispatchOutcome classifyBody(
            IntegrationEventBinding binding, OperationInvocationResult result) {
        Map<String, Object> conditions = binding.responseConditions();
        if (conditions == null || conditions.isEmpty()) {
            return DispatchOutcome.succeeded(result.summary());
        }

        Map<String, Object> parsed = parseObject(result.body());
        if (parsed == null) {
            // The operator declared the body carries the verdict; a body that cannot be
            // read has no verdict, and the same bytes will parse the same way forever.
            return DispatchOutcome.permanentFailure(
                    "Response conditions are configured but the response is not a JSON object: "
                            + result.summary());
        }

        Map<String, Object> context = Map.of("response", parsed);
        if (EventConditionMatcher.matches(asFlatMap(conditions.get(CONDITION_SUCCESS)), context)) {
            return DispatchOutcome.succeeded(result.summary());
        }
        Map<String, Object> retry = asFlatMap(conditions.get(CONDITION_RETRY));
        if (retry != null && !retry.isEmpty() && EventConditionMatcher.matches(retry, context)) {
            return DispatchOutcome.transientFailure(
                    "Partner answered a transient rejection: " + result.summary());
        }
        return DispatchOutcome.permanentFailure(
                "Partner rejected the request in its response body: " + result.summary());
    }

    private Map<String, Object> parseObject(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(body, Map.class);
            return parsed;
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asFlatMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : null;
    }
}

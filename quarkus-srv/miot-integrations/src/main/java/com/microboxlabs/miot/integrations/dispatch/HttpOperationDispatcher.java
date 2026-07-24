package com.microboxlabs.miot.integrations.dispatch;

import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.IntegrationOperationInvoker;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * The default channel: call the binding's operation over HTTP.
 *
 * <p>{@link #supports} returns <b>false</b> and the registry holds this as its explicit
 * fallback — the same idiom as {@code GenericConnectionTester}. Claiming every provider
 * instead would make it race channel-specific dispatchers on iteration order.
 *
 * <p>Being the default is deliberate: a partner API added tomorrow needs a connection and an
 * operation, not a new dispatcher.
 */
@ApplicationScoped
public class HttpOperationDispatcher implements ChannelDispatcher {

    private final IntegrationOperationInvoker invoker;

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
            return DispatchOutcome.succeeded(result.summary());
        }
        // The partner's own status decides: 5xx/408/429 are "later", every other 4xx is
        // "never" and parking beats retrying a request it will keep rejecting.
        return result.retryable()
                ? DispatchOutcome.transientFailure(result.summary())
                : DispatchOutcome.permanentFailure(result.summary());
    }
}

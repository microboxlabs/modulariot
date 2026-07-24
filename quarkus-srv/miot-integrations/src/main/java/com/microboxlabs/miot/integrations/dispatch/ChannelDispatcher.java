package com.microboxlabs.miot.integrations.dispatch;

import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import com.microboxlabs.miot.integrations.domain.ProviderType;

/**
 * Delivers a rendered payload to one kind of channel.
 *
 * <p>Most channels are "call an operation over HTTP", which {@link HttpOperationDispatcher}
 * covers for every provider type. WhatsApp is not: it has no {@code integration_operations}
 * row to point at, its {@code phone_number_id} lives in connection metadata, and its template
 * body is nested in a way a flat {@code fieldId -> value} map cannot express. Forcing it into
 * an operation would be jamming it into a shape it does not have.
 *
 * <p>So channel differences live here, in a dispatcher, rather than in the binding schema —
 * which is why one table serves every channel. Register one {@code @ApplicationScoped}
 * implementation per family; {@link ChannelDispatcherRegistry} routes by
 * {@link ProviderType}. Mirrors {@code ConnectionTesterRegistry} and
 * {@code CredentialAuthRegistry}.
 *
 * <p>A dispatcher living in another module is fine and expected — {@code miot-conversational}
 * already depends on this one, so a WhatsApp dispatcher belongs there and is discovered here
 * by CDI without this module ever depending on it.
 */
public interface ChannelDispatcher {

    /** Whether this dispatcher handles the connection's provider. */
    boolean supports(ProviderType providerType);

    /**
     * Whether a binding for this channel must name an {@code operation_id}. False for channels
     * whose call is not described by a stored operation.
     */
    default boolean requiresOperation() {
        return true;
    }

    /**
     * Delivers the payload.
     *
     * @param payload the rendered body, already coerced to the channel's declared types — a
     *        {@code Map} for an object contract, a {@code List} for an array one
     * @throws com.microboxlabs.miot.integrations.service.OperationInvocationException when the
     *         call could not be completed at all
     */
    DispatchOutcome dispatch(
            String tenantClientId, IntegrationEventBinding binding, Object payload);
}

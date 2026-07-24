package com.microboxlabs.miot.integrations.dispatch;

import com.microboxlabs.miot.integrations.domain.ProviderType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

/**
 * Routes a connection to the {@link ChannelDispatcher} that handles its provider type,
 * falling back to {@link HttpOperationDispatcher} — the "call its operation" behaviour that
 * suits any ordinary HTTP partner.
 *
 * <p>Unlike {@code CredentialAuthRegistry}, a fallback is right here: an unrecognized provider
 * still has a base URL and an operation, so the generic path is a correct default rather than
 * a silent wrong answer.
 */
@ApplicationScoped
public class ChannelDispatcherRegistry {

    private final Iterable<ChannelDispatcher> dispatchers;
    private final ChannelDispatcher fallback;

    @Inject
    public ChannelDispatcherRegistry(
            Instance<ChannelDispatcher> dispatchers, HttpOperationDispatcher fallback) {
        this((Iterable<ChannelDispatcher>) dispatchers, fallback);
    }

    /** Takes the plain {@link Iterable} that {@code Instance} already is, so tests need no CDI. */
    public ChannelDispatcherRegistry(
            Iterable<ChannelDispatcher> dispatchers, ChannelDispatcher fallback) {
        this.dispatchers = dispatchers;
        this.fallback = fallback;
    }

    public ChannelDispatcher dispatcherFor(ProviderType providerType) {
        for (ChannelDispatcher dispatcher : dispatchers) {
            if (dispatcher.supports(providerType)) {
                return dispatcher;
            }
        }
        return fallback;
    }
}

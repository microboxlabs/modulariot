package com.microboxlabs.miot.integrations.auth;

import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.EnumMap;
import java.util.Map;

/**
 * Routes a credential to the {@link CredentialAuthProvider} that handles its
 * {@link AuthType}.
 *
 * <p>The index is built once at construction from every CDI-visible provider. Two
 * providers claiming the same auth type is a <b>startup failure</b>, not a
 * last-one-wins surprise at 3am — the same fail-fast contract {@code ModulithJobWorker}
 * applies to duplicate job types.
 *
 * <p>Unlike {@code ConnectionTesterRegistry} there is no fallback: silently sending an
 * unauthenticated request because nobody handles the type would turn a configuration
 * mistake into a 401 from the partner (or worse, an accepted anonymous write).
 */
@ApplicationScoped
public class CredentialAuthRegistry {

    private final Map<AuthType, CredentialAuthProvider> byType;

    @Inject
    public CredentialAuthRegistry(Instance<CredentialAuthProvider> providers) {
        this((Iterable<CredentialAuthProvider>) providers);
    }

    /** Takes the plain {@link Iterable} that {@code Instance} already is, so tests need no CDI. */
    CredentialAuthRegistry(Iterable<CredentialAuthProvider> providers) {
        this.byType = index(providers);
    }

    static Map<AuthType, CredentialAuthProvider> index(Iterable<CredentialAuthProvider> providers) {
        Map<AuthType, CredentialAuthProvider> index = new EnumMap<>(AuthType.class);
        for (CredentialAuthProvider provider : providers) {
            for (AuthType type : provider.supportedTypes()) {
                CredentialAuthProvider existing = index.put(type, provider);
                if (existing != null) {
                    throw new IllegalStateException(
                            "Two credential auth providers claim " + type + ": "
                                    + existing.getClass().getName() + " and "
                                    + provider.getClass().getName());
                }
            }
        }
        return Map.copyOf(index);
    }

    /**
     * @throws AuthResolutionException when no provider handles the credential's auth type
     */
    public ResolvedAuth resolve(CredentialAuthContext context) {
        return providerFor(context.authType()).resolve(context);
    }

    /**
     * @throws AuthResolutionException when the type is unhandled
     */
    public CredentialAuthProvider providerFor(AuthType authType) {
        CredentialAuthProvider provider = byType.get(authType);
        if (provider == null) {
            throw new AuthResolutionException(
                    "No credential auth provider is registered for " + authType);
        }
        return provider;
    }
}

package com.microboxlabs.miot.integrations.auth;

import com.microboxlabs.miot.integrations.domain.AuthType;
import java.util.Set;

/**
 * Turns a stored credential into the headers/query params an outbound request needs.
 *
 * <p>Why this exists alongside {@link AuthStrategy}: a strategy is generic over a
 * <i>typed</i> config record ({@code AuthStrategy<BearerTokenConfig>}), so nothing can
 * dispatch over strategies by {@link AuthType} without unchecked casts — and building
 * each config from a credential's key/value halves is per-type work anyway. A provider
 * is the uniform, castable-free face of that pair: it owns the config construction and
 * delegates the actual grant to its strategy.
 *
 * <p>Register one {@code @ApplicationScoped} implementation per auth type;
 * {@link CredentialAuthRegistry} discovers them via CDI and indexes them by
 * {@link #supportedTypes()} — adding an auth type is a new bean, not a branch in the
 * invoker. Mirrors the {@code ConnectionTesterRegistry} idiom.
 */
public interface CredentialAuthProvider {

    /** The auth types this provider handles. Must not overlap another provider's. */
    Set<AuthType> supportedTypes();

    /**
     * @throws AuthResolutionException when the credential is incomplete for its type or
     *         an upstream token grant fails
     */
    ResolvedAuth resolve(CredentialAuthContext context);
}

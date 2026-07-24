package com.microboxlabs.miot.integrations.auth;

import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Map;
import java.util.Set;

/**
 * {@link AuthType#NONE} — an endpoint that needs no credential (an open webhook, a
 * partner that authenticates by source IP).
 *
 * <p>Registered explicitly rather than defaulted to, so "no auth" is a configuration the
 * operator chose and not the silent outcome of an unhandled type.
 */
@ApplicationScoped
public class NoAuthProvider implements CredentialAuthProvider {

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.NONE);
    }

    @Override
    public ResolvedAuth resolve(CredentialAuthContext context) {
        return new ResolvedAuth(Map.of(), Map.of(), null);
    }
}

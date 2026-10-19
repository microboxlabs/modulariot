package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.core.iam.ServiceAccountTokenIssuer;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.NoSuchElementException;

/** Gets a service account's token from one of the organization's stored credentials. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class CredentialTokenIssuer implements ServiceAccountTokenIssuer {

    private static final String BEARER = "Bearer ";

    private final CredentialAuthResolver resolver;

    @Inject
    public CredentialTokenIssuer(CredentialAuthResolver resolver) {
        this.resolver = resolver;
    }

    @Override
    public Uni<IssuedToken> issue(Organization organization, String credentialRef) {
        String tenantCode = organization.tenantClientId;
        return Uni.createFrom().item(() -> token(tenantCode, credentialRef))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    static IssuedToken token(ResolvedAuth auth) {
        String header = auth.headers().get("Authorization");
        if (header == null || !header.startsWith(BEARER)) {
            throw new IllegalStateException("The linked credential does not produce a bearer token");
        }
        Instant expiresAt = auth.expiresAt() == null ? Instant.now().plusSeconds(300) : auth.expiresAt();
        return new IssuedToken(header.substring(BEARER.length()), expiresAt);
    }

    private IssuedToken token(String tenantCode, String credentialRef) {
        ResolvedAuth auth;
        try {
            auth = resolver.resolve(tenantCode, credentialRef);
        } catch (AuthResolutionException e) {
            throw new IllegalStateException("The linked credential could not produce a token: " + e.getMessage(), e);
        }
        if (auth == null) {
            throw new NoSuchElementException("The linked credential no longer exists");
        }
        return token(auth);
    }
}

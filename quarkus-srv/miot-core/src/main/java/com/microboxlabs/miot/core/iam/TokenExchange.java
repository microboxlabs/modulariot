package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.ServiceAccountTokenIssuer.IssuedToken;
import com.microboxlabs.miot.core.iam.model.IamServiceAccount;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Trades an API key for the access token of the credential linked to its service account, so a client that can
 * only send a fixed key can call services that accept only OAuth tokens. Tokens are reused until a minute before
 * they expire, so each GPS signal does not cost a token request.
 */
@ApplicationScoped
public class TokenExchange {

    static final Duration EARLY = Duration.ofSeconds(60);

    private record Cached(String credentialRef, IssuedToken token) {
    }

    private final ServiceAccountTokenIssuer issuer;
    private final Map<UUID, Cached> cache = new ConcurrentHashMap<>();

    @Inject
    public TokenExchange(ServiceAccountTokenIssuer issuer) {
        this.issuer = issuer;
    }

    /**
     * @throws SecurityException when the caller is not a service account, or it is disabled or gone
     * @throws IllegalStateException when the account has no linked credential
     */
    @SuppressWarnings("java:S3252") // Reactive Panache generates findById per entity.
    public Uni<IssuedToken> exchange(Caller caller) {
        if (caller == null || !caller.isServiceAccount()) {
            return Uni.createFrom().failure(new SecurityException("Authenticate with an API key"));
        }
        return Panache.withSession(() -> IamServiceAccount.findOne(caller.serviceAccountOrganizationId(),
                caller.serviceAccountId()).flatMap(account -> {
                    if (account == null || account.disabled) {
                        throw new SecurityException("The service account is disabled or no longer exists");
                    }
                    if (account.tokenCredentialRef == null) {
                        throw new IllegalStateException("No credential is linked to this service account");
                    }
                    Cached cached = cache.get(account.id);
                    if (cached != null && cached.credentialRef().equals(account.tokenCredentialRef)
                            && cached.token().expiresAt().minus(EARLY).isAfter(Instant.now())) {
                        return Uni.createFrom().item(cached.token());
                    }
                    String ref = account.tokenCredentialRef;
                    UUID id = account.id;
                    return Organization.<Organization>findById(account.organizationId)
                            .flatMap(org -> issuer.issue(org, ref))
                            .invoke(token -> cache.put(id, new Cached(ref, token)));
                }));
    }

    /** Drops a cached token, for example after the account's credential changes. */
    public void forget(UUID serviceAccountId) {
        cache.remove(serviceAccountId);
    }
}

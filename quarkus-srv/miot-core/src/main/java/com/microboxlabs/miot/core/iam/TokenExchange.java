package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.gps.GpsAccessCatalog;
import com.microboxlabs.miot.core.gps.GpsTokenSource;
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
 * only send a fixed key can call services that accept only OAuth tokens. An account with no linked credential that
 * may send GPS positions gets a token for its organization's own Auth0 application instead. Tokens are reused until
 * a minute before they expire, so each GPS signal does not cost a token request.
 */
@ApplicationScoped
public class TokenExchange {

    static final Duration EARLY = Duration.ofSeconds(60);
    /** Cache key of a token for the organization's Auth0 application, which no stored credential can match. */
    static final String ORGANIZATION_APPLICATION = "auth0-application:";

    private record Cached(String credentialRef, IssuedToken token) {
    }

    private final ServiceAccountTokenIssuer issuer;
    private final GpsTokenSource gpsTokens;
    private final AccessEvaluator evaluator;
    private final Map<UUID, Cached> cache = new ConcurrentHashMap<>();

    @Inject
    public TokenExchange(ServiceAccountTokenIssuer issuer, GpsTokenSource gpsTokens, AccessEvaluator evaluator) {
        this.issuer = issuer;
        this.gpsTokens = gpsTokens;
        this.evaluator = evaluator;
    }

    /**
     * @throws SecurityException when the caller is not a service account, or it is disabled or gone
     * @throws IllegalStateException when the account has no linked credential and may not send GPS positions, or
     *         the token cannot be issued
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
                        return Organization.<Organization>findById(account.organizationId)
                                .flatMap(org -> organizationApplicationToken(org, caller, account.id));
                    }
                    String ref = account.tokenCredentialRef;
                    UUID id = account.id;
                    Cached cached = fresh(id, ref);
                    if (cached != null) {
                        return Uni.createFrom().item(cached.token());
                    }
                    return Organization.<Organization>findById(account.organizationId)
                            .flatMap(org -> issuer.issue(org, ref))
                            .invoke(token -> cache.put(id, new Cached(ref, token)));
                }));
    }

    /** Needs an open session: the evaluator reads memberships and bindings. Checked on every exchange. */
    private Uni<IssuedToken> organizationApplicationToken(Organization org, Caller caller, UUID accountId) {
        String ref = ORGANIZATION_APPLICATION + org.tenantClientId;
        return evaluator.evaluate(org, caller).flatMap(access -> {
            if (!access.can(GpsAccessCatalog.TRACK_WRITE)) {
                throw new IllegalStateException("No credential is linked to this service account");
            }
            Cached cached = fresh(accountId, ref);
            if (cached != null) {
                return Uni.createFrom().item(cached.token());
            }
            return gpsTokens.issue(org).invoke(token -> cache.put(accountId, new Cached(ref, token)));
        });
    }

    private Cached fresh(UUID accountId, String ref) {
        Cached cached = cache.get(accountId);
        return cached != null && cached.credentialRef().equals(ref)
                && cached.token().expiresAt().minus(EARLY).isAfter(Instant.now()) ? cached : null;
    }

    /** Drops a cached token, for example after the account's credential changes. */
    public void forget(UUID serviceAccountId) {
        cache.remove(serviceAccountId);
    }
}

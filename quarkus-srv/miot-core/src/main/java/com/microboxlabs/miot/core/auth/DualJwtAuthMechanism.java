package com.microboxlabs.miot.core.auth;

import io.quarkus.security.identity.IdentityProviderManager;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.vertx.http.runtime.security.ChallengeData;
import io.quarkus.vertx.http.runtime.security.HttpAuthenticationMechanism;
import io.smallrye.jwt.auth.principal.DefaultJWTCallerPrincipal;
import io.smallrye.mutiny.Uni;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jose4j.jwk.HttpsJwks;
import org.jose4j.jwt.JwtClaims;
import org.jose4j.jwt.consumer.JwtConsumer;
import org.jose4j.jwt.consumer.JwtConsumerBuilder;
import org.jose4j.keys.HmacKey;
import org.jose4j.keys.resolvers.HttpsJwksVerificationKeyResolver;
import org.jboss.logging.Logger;
import io.vertx.ext.web.RoutingContext;

/**
 * Path-based JWT authentication mechanism for Auth0.
 *
 * <p>Routes token verification by request path:
 * <ul>
 *   <li><b>M2M paths</b> ({@code /api/v1/asset/track}, {@code /api/v1/stream/*}) → HS256 via shared secret</li>
 *   <li><b>Web paths</b> ({@code /api/v1/orgs/*}, etc.) → RS256 via Auth0 JWKS endpoint</li>
 * </ul>
 *
 * <p>No fallback chain — each path uses exactly one verification strategy.
 * This avoids wasted verification attempts and makes auth failures unambiguous.
 */
@ApplicationScoped
@Alternative
@Priority(1)
public class DualJwtAuthMechanism implements HttpAuthenticationMechanism {

    private static final Logger LOG = Logger.getLogger(DualJwtAuthMechanism.class);
    private static final String BEARER_PREFIX = "Bearer ";

    @ConfigProperty(name = "mp.jwt.verify.issuer", defaultValue = "https://placeholder.auth0.com/")
    String issuer;

    @ConfigProperty(name = "miot.auth.jwks-url", defaultValue = "not-configured")
    String jwksUrl;

    @ConfigProperty(name = "miot.auth.hs256-secret", defaultValue = "not-configured")
    String hs256Secret;

    /** Paths that use HS256 M2M tokens. Matched as prefix. */
    @ConfigProperty(name = "miot.auth.m2m-paths",
            defaultValue = "/api/v1/asset/,/api/v1/stream/,/api/v1/tasks/")
    List<String> m2mPaths;

    private JwtConsumer hs256Consumer;
    private JwtConsumer rs256Consumer;

    @PostConstruct
    void init() {
        if (!"not-configured".equals(hs256Secret)) {
            hs256Consumer = new JwtConsumerBuilder()
                    .setVerificationKey(new HmacKey(hs256Secret.getBytes()))
                    .setExpectedIssuer(issuer)
                    .setRequireExpirationTime()
                    .setSkipDefaultAudienceValidation()
                    .build();
            LOG.infof("HS256 verification configured for M2M paths: %s", m2mPaths);
        }

        if (!"not-configured".equals(jwksUrl)) {
            HttpsJwks httpsJwks = new HttpsJwks(jwksUrl);
            rs256Consumer = new JwtConsumerBuilder()
                    .setVerificationKeyResolver(new HttpsJwksVerificationKeyResolver(httpsJwks))
                    .setExpectedIssuer(issuer)
                    .setRequireExpirationTime()
                    .setSkipDefaultAudienceValidation()
                    .build();
            LOG.infof("RS256 verification configured via JWKS for web paths");
        }
    }

    @Override
    public Uni<SecurityIdentity> authenticate(RoutingContext context,
            IdentityProviderManager identityProviderManager) {
        String authHeader = context.request().getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return Uni.createFrom().nullItem();
        }

        String token = authHeader.substring(BEARER_PREFIX.length()).trim();
        String path = context.request().path();
        boolean isM2m = isM2mPath(path);

        return Uni.createFrom().item(() -> {
            JwtConsumer consumer = isM2m ? hs256Consumer : rs256Consumer;
            String alg = isM2m ? "HS256" : "RS256";

            if (consumer == null) {
                LOG.warnf("%s verification not configured for path: %s", alg, path);
                return null;
            }

            try {
                JwtClaims claims = consumer.processToClaims(token);
                LOG.debugf("Token verified via %s for path %s. sub=%s", alg, path, claims.getSubject());
                return createIdentity(token, claims);
            } catch (Exception e) {
                LOG.debugf("%s verification failed for path %s: %s", alg, path, e.getMessage());
                return null;
            }
        });
    }

    private boolean isM2mPath(String path) {
        for (String prefix : m2mPaths) {
            if (path.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private SecurityIdentity createIdentity(String token, JwtClaims claims) {
        try {
            DefaultJWTCallerPrincipal principal = new DefaultJWTCallerPrincipal(token, claims);
            return io.quarkus.security.runtime.QuarkusSecurityIdentity.builder()
                    .setPrincipal(principal)
                    .addRoles(extractRoles(claims))
                    .build();
        } catch (Exception e) {
            LOG.errorf(e, "Failed to create security identity from verified token");
            return null;
        }
    }

    private Set<String> extractRoles(JwtClaims claims) {
        try {
            Object scope = claims.getClaimValue("scope");
            if (scope instanceof String s) {
                return Set.of(s.split("\\s+"));
            }
            Object role = claims.getClaimValue("role");
            if (role instanceof String r) {
                return Set.of(r);
            }
        } catch (Exception e) {
            LOG.debug("No roles found in token claims");
        }
        return Collections.emptySet();
    }

    @Override
    public Uni<ChallengeData> getChallenge(RoutingContext context) {
        return Uni.createFrom().item(new ChallengeData(401, "WWW-Authenticate", "Bearer"));
    }
}

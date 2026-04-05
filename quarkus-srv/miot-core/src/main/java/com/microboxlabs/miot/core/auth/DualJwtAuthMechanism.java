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
 * Dual-algorithm JWT authentication mechanism for Auth0.
 *
 * <p>Tries HS256 (M2M symmetric key from secret.jwk) first, then falls back
 * to RS256 (Auth0 JWKS endpoint) for web application tokens.
 *
 * <p>Replaces SmallRye JWT's built-in mechanism to support both token types
 * from the same Auth0 tenant.
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

    private JwtConsumer hs256Consumer;
    private JwtConsumer rs256Consumer;
    @PostConstruct
    void init() {

        // HS256 consumer (M2M tokens)
        if (!"not-configured".equals(hs256Secret)) {
            byte[] secretBytes = hs256Secret.getBytes();
            hs256Consumer = new JwtConsumerBuilder()
                    .setVerificationKey(new HmacKey(secretBytes))
                    .setExpectedIssuer(issuer)
                    .setRequireExpirationTime()
                    .setSkipDefaultAudienceValidation()
                    .build();
            LOG.info("HS256 JWT verification configured for M2M tokens");
        }

        // RS256 consumer (web app tokens via JWKS)
        if (!"not-configured".equals(jwksUrl)) {
            HttpsJwks httpsJwks = new HttpsJwks(jwksUrl);
            rs256Consumer = new JwtConsumerBuilder()
                    .setVerificationKeyResolver(new HttpsJwksVerificationKeyResolver(httpsJwks))
                    .setExpectedIssuer(issuer)
                    .setRequireExpirationTime()
                    .setSkipDefaultAudienceValidation()
                    .build();
            LOG.info("RS256 JWT verification configured via JWKS: " + jwksUrl);
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

        return Uni.createFrom().item(() -> {
            // Try HS256 first (M2M — most common for IoT devices)
            if (hs256Consumer != null) {
                try {
                    JwtClaims claims = hs256Consumer.processToClaims(token);
                    LOG.debugf("Token verified via HS256. sub=%s", claims.getSubject());
                    return createIdentity(token, claims);
                } catch (Exception e) {
                    LOG.warnf("HS256 verification failed, trying RS256: %s", e.getMessage());
                }
            }

            // Fall back to RS256 (web app tokens)
            if (rs256Consumer != null) {
                try {
                    JwtClaims claims = rs256Consumer.processToClaims(token);
                    LOG.debugf("Token verified via RS256. sub=%s", claims.getSubject());
                    return createIdentity(token, claims);
                } catch (Exception e) {
                    LOG.warnf("RS256 verification failed: %s", e.getMessage());
                }
            }

            LOG.warn("JWT verification failed for all algorithms");
            return null;
        });
    }

    private SecurityIdentity createIdentity(String token, JwtClaims claims) {
        try {
            // Build a DefaultJWTCallerPrincipal directly from the already-verified claims
            // This avoids re-verification and is compatible with JsonWebToken injection
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
            // Auth0 puts roles in "scope" (space-separated) or "role" claim
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

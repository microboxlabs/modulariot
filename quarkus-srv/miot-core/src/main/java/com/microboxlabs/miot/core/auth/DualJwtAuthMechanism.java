package com.microboxlabs.miot.core.auth;

import io.quarkus.security.identity.IdentityProviderManager;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.vertx.http.runtime.security.ChallengeData;
import io.quarkus.vertx.http.runtime.security.HttpAuthenticationMechanism;
import io.smallrye.jwt.auth.principal.DefaultJWTCallerPrincipal;
import io.smallrye.mutiny.Uni;
import io.vertx.ext.web.RoutingContext;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.ws.rs.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;
import org.jose4j.jwk.HttpsJwks;
import org.jose4j.jwt.JwtClaims;
import org.jose4j.jwt.consumer.JwtConsumer;
import org.jose4j.jwt.consumer.JwtConsumerBuilder;
import org.jose4j.keys.HmacKey;
import org.jose4j.keys.resolvers.HttpsJwksVerificationKeyResolver;

/**
 * Path-based JWT authentication mechanism for Auth0.
 *
 * <p>Routes token verification by resource annotation:
 * <ul>
 *   <li>Resources annotated with {@link M2MAuth} → HS256 (shared secret)</li>
 *   <li>All other {@code /api/*} resources → RS256 (Auth0 JWKS)</li>
 * </ul>
 *
 * <p>M2M paths are auto-discovered at startup by scanning CDI beans
 * for the {@code @M2MAuth} + {@code @Path} annotations.
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

    @Inject
    Instance<Object> allBeans;

    private JwtConsumer hs256Consumer;
    private JwtConsumer rs256Consumer;
    private List<String> m2mPathPrefixes;

    @PostConstruct
    void init() {
        m2mPathPrefixes = discoverM2mPaths();

        if (!"not-configured".equals(hs256Secret)) {
            hs256Consumer = new JwtConsumerBuilder()
                    .setVerificationKey(new HmacKey(hs256Secret.getBytes()))
                    .setExpectedIssuer(issuer)
                    .setRequireExpirationTime()
                    .setSkipDefaultAudienceValidation()
                    .build();
            LOG.infof("HS256 verification configured for @M2MAuth paths: %s", m2mPathPrefixes);
        }

        if (!"not-configured".equals(jwksUrl)) {
            HttpsJwks httpsJwks = new HttpsJwks(jwksUrl);
            rs256Consumer = new JwtConsumerBuilder()
                    .setVerificationKeyResolver(new HttpsJwksVerificationKeyResolver(httpsJwks))
                    .setExpectedIssuer(issuer)
                    .setRequireExpirationTime()
                    .setSkipDefaultAudienceValidation()
                    .build();
            LOG.info("RS256 verification configured via JWKS for web paths");
        }
    }

    /**
     * Scan all CDI beans for @M2MAuth + @Path annotations
     * to build the M2M path prefix list.
     */
    private List<String> discoverM2mPaths() {
        List<String> paths = new ArrayList<>();
        for (var bean : io.quarkus.arc.Arc.container().beanManager().getBeans(Object.class)) {
            Class<?> beanClass = bean.getBeanClass();
            if (beanClass.isAnnotationPresent(M2MAuth.class)
                    && beanClass.isAnnotationPresent(Path.class)) {
                String path = beanClass.getAnnotation(Path.class).value();
                if (!path.startsWith("/")) {
                    path = "/" + path;
                }
                paths.add(path);
                LOG.infof("Discovered @M2MAuth resource: %s -> %s",
                        beanClass.getSimpleName(), path);
            }
        }
        return paths;
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
                LOG.debugf("Token verified via %s for path %s. sub=%s",
                        alg, path, claims.getSubject());
                return createIdentity(token, claims);
            } catch (Exception e) {
                LOG.debugf("%s verification failed for path %s: %s",
                        alg, path, e.getMessage());
                return null;
            }
        });
    }

    private boolean isM2mPath(String path) {
        for (String prefix : m2mPathPrefixes) {
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

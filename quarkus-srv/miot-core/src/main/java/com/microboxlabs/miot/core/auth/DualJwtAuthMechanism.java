package com.microboxlabs.miot.core.auth;

import io.quarkus.security.identity.IdentityProviderManager;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.credential.TokenCredential;
import io.quarkus.vertx.http.runtime.security.ChallengeData;
import io.quarkus.vertx.http.runtime.security.HttpAuthenticationMechanism;
import io.smallrye.jwt.auth.principal.DefaultJWTCallerPrincipal;
import io.smallrye.mutiny.Uni;
import io.vertx.ext.web.RoutingContext;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import jakarta.ws.rs.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
 *   <li>Resources annotated with {@link M2MAuth} -> HS256 (shared secret)</li>
 *   <li>All other {@code /api/*} resources -> RS256 (Auth0 JWKS)</li>
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
    private static final String NOT_CONFIGURED = "not-configured";

    /** A JAX-RS path-template variable, e.g. {organizationId} or {id:\\d+}. */
    private static final Pattern PATH_TEMPLATE_VAR = Pattern.compile("\\{[^/}]+}");

    private final String hs256Issuer;
    private final String rs256Issuer;
    private final String jwksUrl;
    private final String hs256Secret;
    private final String hs256Audience;
    private final String rs256Audience;

    private JwtConsumer hs256Consumer;
    private JwtConsumer rs256Consumer;
    private List<Pattern> m2mPathPatterns;

    DualJwtAuthMechanism(
            @ConfigProperty(name = "miot.auth.hs256-issuer", defaultValue = "https://placeholder.auth0.com/")
                    String hs256Issuer,
            @ConfigProperty(name = "miot.auth.rs256-issuer", defaultValue = "https://placeholder.auth0.com/")
                    String rs256Issuer,
            @ConfigProperty(name = "miot.auth.jwks-url", defaultValue = NOT_CONFIGURED)
                    String jwksUrl,
            @ConfigProperty(name = "miot.auth.hs256-secret", defaultValue = NOT_CONFIGURED)
                    String hs256Secret,
            @ConfigProperty(name = "miot.auth.hs256-audience", defaultValue = NOT_CONFIGURED)
                    String hs256Audience,
            @ConfigProperty(name = "miot.auth.rs256-audience", defaultValue = NOT_CONFIGURED)
                    String rs256Audience) {
        this.hs256Issuer = hs256Issuer;
        this.rs256Issuer = rs256Issuer;
        this.jwksUrl = jwksUrl;
        this.hs256Secret = hs256Secret;
        this.hs256Audience = hs256Audience;
        this.rs256Audience = rs256Audience;
    }

    @PostConstruct
    void init() {
        m2mPathPatterns = discoverM2mPaths();

        if (!NOT_CONFIGURED.equals(hs256Secret)) {
            var hs256Builder = new JwtConsumerBuilder()
                    .setVerificationKey(new HmacKey(hs256Secret.getBytes()))
                    .setExpectedIssuer(hs256Issuer)
                    .setRequireExpirationTime();
            if (!NOT_CONFIGURED.equals(hs256Audience)) {
                hs256Builder.setExpectedAudience(hs256Audience);
            } else {
                hs256Builder.setSkipDefaultAudienceValidation();
            }
            hs256Consumer = hs256Builder.build();
            LOG.infof("HS256 verification configured for %d @M2MAuth path pattern(s) issuer=%s",
                    m2mPathPatterns.size(), hs256Issuer);
        }

        if (!NOT_CONFIGURED.equals(jwksUrl)) {
            HttpsJwks httpsJwks = new HttpsJwks(jwksUrl);
            var rs256Builder = new JwtConsumerBuilder()
                    .setVerificationKeyResolver(new HttpsJwksVerificationKeyResolver(httpsJwks))
                    .setExpectedIssuer(rs256Issuer)
                    .setRequireExpirationTime();
            if (!NOT_CONFIGURED.equals(rs256Audience)) {
                rs256Builder.setExpectedAudience(rs256Audience);
            } else {
                rs256Builder.setSkipDefaultAudienceValidation();
            }
            rs256Consumer = rs256Builder.build();
            LOG.infof("RS256 verification configured via JWKS for web paths issuer=%s jwks=%s",
                    rs256Issuer, jwksUrl);
        }
    }

    private List<Pattern> discoverM2mPaths() {
        List<Pattern> patterns = new ArrayList<>();
        for (var bean : io.quarkus.arc.Arc.container().beanManager().getBeans(Object.class)) {
            Class<?> beanClass = bean.getBeanClass();
            if (beanClass.isAnnotationPresent(M2MAuth.class)
                    && beanClass.isAnnotationPresent(Path.class)) {
                String path = beanClass.getAnnotation(Path.class).value();
                if (!path.startsWith("/")) {
                    path = "/" + path;
                }
                patterns.add(templateToPattern(path));
                LOG.infof("Discovered @M2MAuth resource: %s -> %s",
                        beanClass.getSimpleName(), path);
            }
        }
        return patterns;
    }

    /**
     * Compiles a JAX-RS {@code @Path} value into a matcher for the runtime
     * request path. Template variables ({@code {organizationId}}) become
     * single-segment wildcards, so an org-scoped resource path like
     * {@code /api/v1/orgs/{organizationId}/integrations/jobs} matches the real
     * {@code /api/v1/orgs/mintral/integrations/jobs} and any sub-path under it.
     * Static paths keep the original "exact or prefix-with-slash" semantics.
     */
    static Pattern templateToPattern(String pathTemplate) {
        StringBuilder regex = new StringBuilder("^");
        Matcher vars = PATH_TEMPLATE_VAR.matcher(pathTemplate);
        int last = 0;
        while (vars.find()) {
            regex.append(Pattern.quote(pathTemplate.substring(last, vars.start())));
            regex.append("[^/]+");
            last = vars.end();
        }
        regex.append(Pattern.quote(pathTemplate.substring(last)));
        regex.append("(/.*)?$");
        return Pattern.compile(regex.toString());
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
        for (Pattern pattern : m2mPathPatterns) {
            if (pattern.matcher(path).matches()) {
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
                    .addCredential(new TokenCredential(token, "Bearer"))
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

package com.microboxlabs.miot.core.gps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth0.Auth0Management;
import com.microboxlabs.miot.core.iam.ServiceAccountTokenIssuer.IssuedToken;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.rest.client.reactive.QuarkusRestClientBuilder;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Gets an access token for an organization's own Auth0 application, the one its GPS provider sends positions
 * with. The token comes from the caching token endpoint ({@code miot.gps.exchange-token-url}), never from Auth0
 * directly, so repeated exchanges do not use up Auth0's machine-to-machine token quota.
 */
@ApplicationScoped
public class GpsTokenSource {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final long DEFAULT_LIFETIME_SECONDS = 300;
    static final Duration EARLY = Duration.ofSeconds(60);

    private final Auth0Management auth0;
    private final Optional<String> tokenUrl;
    private final Supplier<GpsTokenApi> apiFactory;
    private final Map<String, IssuedToken> tokens = new ConcurrentHashMap<>();
    private final Map<String, Uni<IssuedToken>> inFlight = new ConcurrentHashMap<>();
    private GpsTokenApi api;

    @Inject
    public GpsTokenSource(Auth0Management auth0,
            @ConfigProperty(name = "miot.gps.exchange-token-url") Optional<String> tokenUrl) {
        this(auth0, tokenUrl, () -> QuarkusRestClientBuilder.newBuilder()
                .baseUri(URI.create(tokenUrl.orElseThrow()))
                .build(GpsTokenApi.class));
    }

    GpsTokenSource(Auth0Management auth0, Optional<String> tokenUrl, Supplier<GpsTokenApi> apiFactory) {
        this.auth0 = auth0;
        this.tokenUrl = tokenUrl.filter(url -> !url.isBlank());
        this.apiFactory = apiFactory;
    }

    /**
     * @throws IllegalStateException when the token endpoint, the audience or the Management API is not configured,
     *         or the endpoint refuses the application
     */
    public Uni<IssuedToken> issue(Organization organization) {
        return issue(organization == null ? null : organization.tenantClientId);
    }

    /**
     * A token for the application {@code clientId}, reused until a minute before it expires. Concurrent calls for
     * the same application share one request.
     *
     * @throws IllegalStateException as {@link #issue(Organization)}
     */
    public Uni<IssuedToken> current(String clientId) {
        if (clientId == null || clientId.isBlank()) {
            return issue(clientId);
        }
        IssuedToken token = tokens.get(clientId);
        if (token != null && token.expiresAt().minus(EARLY).isAfter(Instant.now())) {
            return Uni.createFrom().item(token);
        }
        return inFlight.computeIfAbsent(clientId, id -> issue(id)
                .invoke(issued -> tokens.put(id, issued))
                .onTermination().invoke(() -> inFlight.remove(id))
                .memoize().indefinitely());
    }

    private Uni<IssuedToken> issue(String clientId) {
        if (tokenUrl.isEmpty()) {
            return Uni.createFrom().failure(
                    new IllegalStateException("No token endpoint is configured for the GPS token exchange"));
        }
        Optional<String> audience = auth0.audience().filter(a -> !a.isBlank());
        if (audience.isEmpty() || !auth0.configured()) {
            return Uni.createFrom().failure(
                    new IllegalStateException("The organization's Auth0 application cannot be used here"));
        }
        if (clientId == null || clientId.isBlank()) {
            return Uni.createFrom().failure(new IllegalStateException("The organization has no Auth0 application"));
        }
        return auth0.secret(clientId)
                .flatMap(secret -> api().token(
                        new GpsTokenApi.TokenRequest(clientId, secret, audience.get(), "client_credentials")))
                .onFailure().transform(GpsTokenSource::refusal)
                .map(GpsTokenSource::issued);
    }

    private static Throwable refusal(Throwable e) {
        return e instanceof WebApplicationException w
                ? new IllegalStateException("The token endpoint refused the organization's application: HTTP "
                        + w.getResponse().getStatus())
                : e;
    }

    private synchronized GpsTokenApi api() {
        if (api == null) {
            api = apiFactory.get();
        }
        return api;
    }

    static IssuedToken issued(GpsTokenApi.TokenResponse response) {
        if (response == null || response.accessToken() == null || response.accessToken().isBlank()) {
            throw new IllegalStateException("The token endpoint returned no access token");
        }
        return new IssuedToken(response.accessToken(), expiresAt(response));
    }

    /**
     * The token's {@code exp} claim. A cached token keeps the {@code expires_in} it was first issued with, so that
     * value is only used when the token is not a readable JWT.
     */
    static Instant expiresAt(GpsTokenApi.TokenResponse response) {
        String[] parts = response.accessToken().split("\\.");
        if (parts.length == 3) {
            try {
                JsonNode claims = JSON.readTree(new String(Base64.getUrlDecoder().decode(parts[1]),
                        StandardCharsets.UTF_8));
                if (claims.path("exp").isNumber()) {
                    return Instant.ofEpochSecond(claims.path("exp").asLong());
                }
            } catch (IllegalArgumentException | IOException e) {
                // Not a JWT: fall back to expires_in.
            }
        }
        long seconds = response.expiresIn() == null ? DEFAULT_LIFETIME_SECONDS : response.expiresIn();
        return Instant.now().plusSeconds(seconds);
    }
}

package com.microboxlabs.miot.core.auth0;

import com.microboxlabs.miot.core.auth0.Auth0ManagementApi.Client;
import com.microboxlabs.miot.core.auth0.Auth0ManagementApi.ClientGrant;
import com.microboxlabs.miot.core.auth0.Auth0ManagementApi.NewClient;
import com.microboxlabs.miot.core.auth0.Auth0ManagementApi.TokenRequest;
import io.quarkus.rest.client.reactive.QuarkusRestClientBuilder;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Creates and reads the Auth0 machine-to-machine applications that identify each tenant, with the platform's
 * Management API credentials. The credentials need the scopes {@code create:clients}, {@code read:clients},
 * {@code read:client_keys}, {@code update:client_keys}, {@code delete:clients} and {@code create:client_grants}.
 *
 * <p>Failures: {@link IllegalStateException} when the credentials are not configured or Auth0 refuses the call,
 * {@link NoSuchElementException} when the application does not exist.
 */
@ApplicationScoped
public class Auth0Management {

    private static final Logger LOG = Logger.getLogger(Auth0Management.class);
    private static final String M2M = "non_interactive";
    private static final int PAGE_SIZE = 100;
    private static final int MAX_PAGES = 20;
    private static final Duration TOKEN_MARGIN = Duration.ofSeconds(60);

    /** An M2M application: its client id and name. */
    public record M2mClient(String clientId, String name) {
    }

    private final Optional<String> domain;
    private final Optional<String> clientId;
    private final Optional<String> clientSecret;
    private final Optional<String> audience;
    private final List<String> scopes;
    private final String namePrefix;
    private final Supplier<Auth0ManagementApi> apiFactory;
    private Auth0ManagementApi api;
    private final AtomicReference<CachedToken> token = new AtomicReference<>();

    private record CachedToken(String value, Instant refreshAt) {
    }

    @Inject
    public Auth0Management(
            @ConfigProperty(name = "miot.auth0.management.domain") Optional<String> domain,
            @ConfigProperty(name = "miot.auth0.management.client-id") Optional<String> clientId,
            @ConfigProperty(name = "miot.auth0.management.client-secret") Optional<String> clientSecret,
            @ConfigProperty(name = "miot.gps.audience") Optional<String> audience,
            @ConfigProperty(name = "miot.gps.scopes", defaultValue = "asset:track:write") String scopes,
            @ConfigProperty(name = "miot.auth0.management.client-name-prefix") Optional<String> namePrefix) {
        this(domain, clientId, clientSecret, audience, scopes, namePrefix.orElse(""), () -> QuarkusRestClientBuilder
                .newBuilder()
                .baseUri(URI.create(baseUrl(domain.orElseThrow())))
                .build(Auth0ManagementApi.class));
    }

    Auth0Management(Optional<String> domain, Optional<String> clientId, Optional<String> clientSecret,
            Optional<String> audience, String scopes, String namePrefix, Supplier<Auth0ManagementApi> apiFactory) {
        this.domain = domain;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.audience = audience;
        this.scopes = Arrays.stream(scopes.split("[,\\s]+")).filter(s -> !s.isBlank()).toList();
        this.namePrefix = namePrefix;
        this.apiFactory = apiFactory;
    }

    /** {@code https://<domain>}; the domain may be given with or without the scheme and trailing slash. */
    static String baseUrl(String domain) {
        String trimmed = domain.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed.startsWith("https://") || trimmed.startsWith("http://") ? trimmed : "https://" + trimmed;
    }

    /** Whether the Management API credentials are set. */
    public boolean configured() {
        return domain.isPresent() && clientId.isPresent() && clientSecret.isPresent();
    }

    /** The API the M2M applications are granted, which their tokens name as audience. */
    public Optional<String> audience() {
        return audience;
    }

    /** The Auth0 endpoint that issues tokens for a client id and secret. */
    public Optional<String> tokenUrl() {
        return domain.map(d -> baseUrl(d) + "/oauth/token");
    }

    /** Whether {@code id} is the platform's own Management API application, which no organization may use. */
    public boolean isManagementClient(String id) {
        return clientId.isPresent() && clientId.get().equals(id);
    }

    /** The name a new application gets for an organization. */
    public String clientName(String slug) {
        return namePrefix + slug;
    }

    /**
     * Creates an M2M application and grants it the GPS API's scopes. The application is deleted again when the
     * grant fails, so a half-made application is not left behind.
     */
    public Uni<M2mClient> createM2mClient(String slug, String description) {
        if (audience.isEmpty()) {
            return Uni.createFrom().failure(new IllegalStateException("miot.gps.audience is not configured"));
        }
        NewClient request = new NewClient(clientName(slug), description, M2M, List.of("client_credentials"),
                "client_secret_post", Map.of("miot_organization", slug));
        return withToken(bearer -> api().createClient(bearer, request)
                .flatMap(created -> api().createGrant(bearer,
                                new ClientGrant(created.clientId(), audience.get(), scopes))
                        .replaceWith(new M2mClient(created.clientId(), created.name()))
                        .onFailure().call(e -> deleteQuietly(bearer, created.clientId()))));
    }

    /** Deletes an application; used to undo a creation whose organization could not be saved. */
    public Uni<Void> deleteClient(String id) {
        return withToken(bearer -> api().deleteClient(bearer, id));
    }

    /** The current secret of an M2M application other than the Management API one. */
    public Uni<String> secret(String id) {
        return withToken(bearer -> requireTenantClient(bearer, id)
                .flatMap(ignored -> api().client(bearer, id, "client_id,client_secret", true)))
                .map(Client::clientSecret);
    }

    /** Replaces the secret of an M2M application other than the Management API one; the old one stops working. */
    public Uni<String> rotateSecret(String id) {
        return withToken(bearer -> requireTenantClient(bearer, id)
                .flatMap(ignored -> api().rotateSecret(bearer, id)))
                .map(Client::clientSecret);
    }

    private Uni<Client> requireTenantClient(String bearer, String id) {
        if (isManagementClient(id)) {
            return Uni.createFrom().failure(new IllegalStateException("This application is not a tenant's"));
        }
        return api().client(bearer, id, "client_id,app_type", true).map(client -> {
            if (!M2M.equals(client.appType())) {
                throw new IllegalStateException("This application is not a tenant's");
            }
            return client;
        });
    }

    /** Every M2M application in the tenant, by name. */
    public Uni<List<M2mClient>> m2mClients() {
        return withToken(bearer -> page(bearer, 0, new ArrayList<>()))
                .map(all -> all.stream()
                        .sorted((a, b) -> String.CASE_INSENSITIVE_ORDER.compare(name(a), name(b)))
                        .toList());
    }

    private Uni<List<M2mClient>> page(String bearer, int page, List<M2mClient> found) {
        return api().clients(bearer, M2M, "client_id,name,app_type", true, page, PAGE_SIZE).flatMap(rows -> {
            rows.stream()
                    .filter(row -> M2M.equals(row.appType()) && !isManagementClient(row.clientId()))
                    .forEach(row -> found.add(new M2mClient(row.clientId(), row.name())));
            if (rows.size() < PAGE_SIZE || page + 1 >= MAX_PAGES) {
                return Uni.createFrom().item(found);
            }
            return page(bearer, page + 1, found);
        });
    }

    private static String name(M2mClient client) {
        return client.name() == null ? "" : client.name();
    }

    private Uni<Void> deleteQuietly(String bearer, String id) {
        return api().deleteClient(bearer, id).onFailure().recoverWithItem(e -> {
            LOG.warnf(e, "Auth0 application %s was created but could not be deleted after a failed grant", id);
            return null;
        });
    }

    private <T> Uni<T> withToken(Function<String, Uni<? extends T>> call) {
        if (!configured()) {
            return Uni.createFrom().failure(new IllegalStateException("Auth0 management is not configured"));
        }
        return bearer()
                .<T>flatMap(bearer -> this.<T>forgetTokenOnUnauthorized(call.apply(bearer)))
                .onFailure(WebApplicationException.class).transform(Auth0Management::failure);
    }

    private <T> Uni<T> forgetTokenOnUnauthorized(Uni<? extends T> call) {
        return call.onFailure(Auth0Management::unauthorized).invoke(e -> token.set(null))
                .map(Function.<T>identity());
    }

    /** A 401 from a Management API call: the cached token is no longer valid, so the next call gets a new one. */
    private static boolean unauthorized(Throwable e) {
        return e instanceof WebApplicationException w && w.getResponse().getStatus() == 401;
    }

    private Uni<String> bearer() {
        CachedToken cached = token.get();
        if (cached != null && Instant.now().isBefore(cached.refreshAt())) {
            return Uni.createFrom().item(cached.value());
        }
        TokenRequest request = new TokenRequest(clientId.orElseThrow(), clientSecret.orElseThrow(),
                baseUrl(domain.orElseThrow()) + "/api/v2/", "client_credentials");
        return api().token(request).map(response -> {
            String value = "Bearer " + response.accessToken();
            token.set(new CachedToken(value,
                    Instant.now().plusSeconds(response.expiresIn()).minus(TOKEN_MARGIN)));
            return value;
        });
    }

    private static Throwable failure(Throwable e) {
        int status = ((WebApplicationException) e).getResponse().getStatus();
        if (status == 404) {
            return new NoSuchElementException("Auth0 application not found");
        }
        return new IllegalStateException("Auth0 refused the request (HTTP " + status + ")", e);
    }

    private synchronized Auth0ManagementApi api() {
        if (api == null) {
            api = apiFactory.get();
        }
        return api;
    }
}

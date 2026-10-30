package com.microboxlabs.miot.integrations.geocoding;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.PlatformConnectionStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The geocoding provider the platform contracts and pays for: one GEOCODING connection under the platform tenant,
 * used for every organization. {@code costPerRequestUsd} is what one call costs the platform, not what an
 * organization is charged. Blocking.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformGeocodingService {

    static final String NAME = "Platform geocoding";

    /** {@code configured} is false and the rest null when no provider is set. */
    public record PlatformGeocodingView(boolean configured, String connectionId, String provider, Boolean permanent,
            BigDecimal costPerRequestUsd, String tokenPreview) {

        static PlatformGeocodingView none() {
            return new PlatformGeocodingView(false, null, null, null, null, null);
        }
    }

    /**
     * {@code provider}: {@code mapbox} (default) or {@code google}. {@code token}: required the first time; blank
     * keeps the stored one. {@code permanent}: Mapbox only, default true.
     */
    public record SetPlatformGeocodingRequest(String provider, String token, Boolean permanent,
            BigDecimal costPerRequestUsd) {
    }

    private final IntegrationConnectionService connections;
    private final PlatformConnectionStore store;
    private final List<GeocodingProvider> providers;

    @Inject
    public PlatformGeocodingService(IntegrationConnectionService connections,
            IntegrationConnectionRepository repository, CredentialProfileService credentials,
            Instance<GeocodingProvider> providers) {
        this(connections, repository, credentials, providers.stream().toList());
    }

    PlatformGeocodingService(IntegrationConnectionService connections, IntegrationConnectionRepository repository,
            CredentialProfileService credentials, List<GeocodingProvider> providers) {
        this.connections = connections;
        this.store = new PlatformConnectionStore(connections, repository, credentials, ProviderType.GEOCODING, NAME);
        this.providers = providers;
    }

    public PlatformGeocodingView get() {
        IntegrationConnection connection = store.find();
        return connection == null ? PlatformGeocodingView.none() : view(connection);
    }

    /**
     * @throws IllegalArgumentException for an unknown provider, a negative cost, or a missing token on first save
     * @throws IllegalStateException when a new token has no credential to go to
     */
    public PlatformGeocodingView put(SetPlatformGeocodingRequest body, String actor) {
        if (body == null) throw new IllegalArgumentException("Request body is required");
        String name = body.provider() == null || body.provider().isBlank()
                ? MapboxGeocoding.PROVIDER_NAME : body.provider().strip().toLowerCase(java.util.Locale.ROOT);
        GeocodingProvider provider = providers.stream().filter(p -> p.name().equals(name)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("unknown geocoding provider " + name));
        String token = body.token() == null ? "" : body.token().strip();
        BigDecimal cost = body.costPerRequestUsd();
        if (cost != null && cost.signum() < 0) {
            throw new IllegalArgumentException(GeocodingConnection.COST + " cannot be negative");
        }
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put(GeocodingConnection.PROVIDER_KEY, provider.name());
        if (MapboxGeocoding.PROVIDER_NAME.equals(provider.name())) {
            metadata.put(GeocodingConnection.PERMANENT_KEY, body.permanent() == null || body.permanent());
        }
        if (cost != null) {
            metadata.put(GeocodingConnection.COST, cost.toPlainString());
        }
        IntegrationConnection existing = store.find();
        if (existing == null) {
            if (token.isEmpty()) {
                throw new IllegalArgumentException("token is required");
            }
            store.create(AuthType.BEARER_TOKEN, Map.of(), Map.of(GeocodingConnection.TOKEN_KEY, token),
                    provider.baseUrl(), metadata, actor);
            return get();
        }
        if (!token.isEmpty()) {
            store.rotateSecret(existing, Map.of(GeocodingConnection.TOKEN_KEY, token));
        }
        connections.updateConnection(PLATFORM_TENANT, existing.id(), new UpdateIntegrationConnectionRequest(
                null, provider.baseUrl(), metadata, null, null));
        return get();
    }

    /** @return false when no provider was set */
    public boolean delete(String actor) {
        return store.delete(actor);
    }

    private PlatformGeocodingView view(IntegrationConnection connection) {
        Map<String, Object> metadata = connection.metadata() == null ? Map.of() : connection.metadata();
        Object provider = metadata.get(GeocodingConnection.PROVIDER_KEY);
        Object permanent = metadata.get(GeocodingConnection.PERMANENT_KEY);
        Object cost = metadata.get(GeocodingConnection.COST);
        String name = provider instanceof String s && !s.isBlank() ? s : MapboxGeocoding.PROVIDER_NAME;
        return new PlatformGeocodingView(true, connection.id(), name,
                MapboxGeocoding.PROVIDER_NAME.equals(name) ? permanent == null || Boolean.parseBoolean(permanent.toString())
                        : null,
                cost == null || cost.toString().isBlank() ? null : new BigDecimal(cost.toString().strip()),
                store.secretPreview(connection));
    }
}

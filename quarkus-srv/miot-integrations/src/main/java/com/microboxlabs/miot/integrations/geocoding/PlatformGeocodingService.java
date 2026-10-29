package com.microboxlabs.miot.integrations.geocoding;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.ManagedCredentials;
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
 * linked to a bearer-token credential the platform owner keeps in Credentials (platform scope). Organizations reach
 * it through their managed connections. {@code costPerRequestUsd} is what one call costs the platform, not what an
 * organization is charged. Blocking.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformGeocodingService {

    static final String NAME = "Platform geocoding";

    /** {@code configured} is false and the rest null when no provider is set. */
    public record PlatformGeocodingView(boolean configured, String connectionId, String provider, Boolean permanent,
            BigDecimal costPerRequestUsd, String credentialProfileId, String credentialName) {

        static PlatformGeocodingView none() {
            return new PlatformGeocodingView(false, null, null, null, null, null, null);
        }
    }

    /**
     * {@code provider}: {@code mapbox} (default) or {@code google}. {@code credentialProfileId}: a bearer-token
     * credential of the platform scope; required the first time, null keeps the current one. {@code permanent}:
     * Mapbox only, default true.
     */
    public record SetPlatformGeocodingRequest(String provider, String credentialProfileId, Boolean permanent,
            BigDecimal costPerRequestUsd) {
    }

    private final IntegrationConnectionService connections;
    private final IntegrationConnectionRepository repository;
    private final CredentialProfileService credentials;
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
        this.repository = repository;
        this.credentials = credentials;
        this.providers = providers;
    }

    public PlatformGeocodingView get() {
        IntegrationConnection connection = find();
        return connection == null ? PlatformGeocodingView.none() : view(connection);
    }

    /**
     * @throws IllegalArgumentException for an unknown provider, a negative cost, a missing credential on first save,
     *         or a credential that is not a platform bearer token
     */
    public PlatformGeocodingView put(SetPlatformGeocodingRequest body, String actor) {
        String name = body == null || body.provider() == null || body.provider().isBlank()
                ? MapboxGeocoding.NAME : body.provider().strip().toLowerCase();
        GeocodingProvider provider = providers.stream().filter(p -> p.name().equals(name)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("unknown geocoding provider " + name));
        String credentialId = body == null || body.credentialProfileId() == null || body.credentialProfileId().isBlank()
                ? null : body.credentialProfileId().strip();
        BigDecimal cost = body == null ? null : body.costPerRequestUsd();
        if (cost != null && cost.signum() < 0) {
            throw new IllegalArgumentException(GeocodingConnection.COST + " cannot be negative");
        }
        if (credentialId != null) {
            requireBearerCredential(credentialId);
        }
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put(GeocodingConnection.PROVIDER, provider.name());
        if (MapboxGeocoding.NAME.equals(provider.name())) {
            metadata.put(GeocodingConnection.PERMANENT, body.permanent() == null || body.permanent());
        }
        if (cost != null) {
            metadata.put(GeocodingConnection.COST, cost.toPlainString());
        }
        IntegrationConnection existing = find();
        if (existing == null) {
            if (credentialId == null) {
                throw new IllegalArgumentException("credentialProfileId is required");
            }
            connections.createConnection(PLATFORM_TENANT, new CreateIntegrationConnectionRequest(
                    NAME, ProviderType.GEOCODING, provider.baseUrl(), credentialId, metadata, null));
            return get();
        }
        connections.updateConnection(PLATFORM_TENANT, existing.id(), new UpdateIntegrationConnectionRequest(
                null, provider.baseUrl(), metadata, credentialId, null, null));
        return get();
    }

    /** Removes the connection; the credential stays in Credentials. @return false when no provider was set */
    public boolean delete(String actor) {
        IntegrationConnection existing = find();
        if (existing == null) {
            return false;
        }
        connections.deleteConnection(PLATFORM_TENANT, existing.id());
        return true;
    }

    private IntegrationConnection find() {
        return repository.findActiveByProvider(PLATFORM_TENANT, ProviderType.GEOCODING);
    }

    private void requireBearerCredential(String id) {
        CredentialProfileResponse credential = credentials.get(PLATFORM_TENANT, id);
        if (credential == null) {
            throw new IllegalArgumentException("credential " + id + " is not a credential of the platform");
        }
        if (credential.authType() != AuthType.BEARER_TOKEN || ManagedCredentials.isManaged(credential.publicConfig())) {
            throw new IllegalArgumentException("the geocoding credential must be a bearer token");
        }
    }

    private PlatformGeocodingView view(IntegrationConnection connection) {
        Map<String, Object> metadata = connection.metadata() == null ? Map.of() : connection.metadata();
        Object provider = metadata.get(GeocodingConnection.PROVIDER);
        Object permanent = metadata.get(GeocodingConnection.PERMANENT);
        Object cost = metadata.get(GeocodingConnection.COST);
        String name = provider instanceof String s && !s.isBlank() ? s : MapboxGeocoding.NAME;
        return new PlatformGeocodingView(true, connection.id(), name,
                MapboxGeocoding.NAME.equals(name) ? permanent == null || Boolean.parseBoolean(permanent.toString())
                        : null,
                cost == null || cost.toString().isBlank() ? null : new BigDecimal(cost.toString().strip()),
                connection.credentialProfileId(), credentialName(connection.credentialProfileId()));
    }

    private String credentialName(String id) {
        CredentialProfileResponse credential = id == null ? null : credentials.get(PLATFORM_TENANT, id);
        return credential == null ? null : credential.displayName();
    }
}

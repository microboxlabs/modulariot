package com.microboxlabs.miot.integrations.vehicleimages;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.Map;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;

/**
 * The platform's vehicle image provider: one CAR_IMAGES connection under the reserved platform tenant, used by every
 * organization without one of its own. Blocking.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PlatformVehicleImagesService {

    static final String NAME = "Platform vehicle images";

    /** {@code configured} is false and the rest null when no provider is set. */
    public record PlatformVehicleImagesView(boolean configured, String connectionId, String apiKey,
            String secretPreview, String status, OffsetDateTime lastTestedAt, Boolean lastTestResult) {

        static PlatformVehicleImagesView none() {
            return new PlatformVehicleImagesView(false, null, null, null, null, null, null);
        }
    }

    /** {@code apiSecret}: required the first time; blank keeps the stored secret. */
    public record SetPlatformVehicleImagesRequest(String apiKey, String apiSecret) {
    }

    private final IntegrationConnectionService connections;
    private final IntegrationConnectionRepository repository;
    private final CredentialProfileService credentials;
    private final CarImagesClient client;

    @Inject
    public PlatformVehicleImagesService(IntegrationConnectionService connections,
            IntegrationConnectionRepository repository, CredentialProfileService credentials,
            CarImagesClient client) {
        this.connections = connections;
        this.repository = repository;
        this.credentials = credentials;
        this.client = client;
    }

    public PlatformVehicleImagesView get() {
        IntegrationConnection connection = connection();
        return connection == null ? PlatformVehicleImagesView.none() : view(connection);
    }

    /**
     * Saves the key and secret and tests them right away, so the status describes what is in use.
     *
     * @throws IllegalArgumentException for a missing key, or a missing secret on first save
     */
    public PlatformVehicleImagesView put(SetPlatformVehicleImagesRequest body, String actor) {
        String apiKey = body == null || body.apiKey() == null ? "" : body.apiKey().trim();
        String secret = body == null || body.apiSecret() == null ? "" : body.apiSecret().trim();
        if (apiKey.isEmpty()) {
            throw new IllegalArgumentException("apiKey is required");
        }
        IntegrationConnection existing = connection();
        String connectionId = existing == null ? create(apiKey, secret, actor) : existing.id();
        if (existing != null) {
            connections.updateConnection(PLATFORM_TENANT, connectionId, new UpdateIntegrationConnectionRequest(
                    null, client.baseUrl(), Map.of(CarImagesKeys.API_KEY, apiKey), null, null));
            if (!secret.isEmpty() && existing.credentialProfileId() != null) {
                credentials.rotateSecret(PLATFORM_TENANT, existing.credentialProfileId(),
                        Map.of(CarImagesKeys.SECRET, secret));
            }
        }
        connections.testConnection(PLATFORM_TENANT, connectionId, new ConnectionTestRequest(null, null));
        return get();
    }

    private String create(String apiKey, String secret, String actor) {
        if (secret.isEmpty()) {
            throw new IllegalArgumentException("apiSecret is required");
        }
        removeCredentials(actor);
        CredentialProfileResponse credential = credentials.create(PLATFORM_TENANT, actor,
                new CreateCredentialProfileRequest(NAME, null, AuthType.API_KEY_HEADER, null,
                        Map.of("name", CarImagesKeys.SECRET_HEADER), Map.of(CarImagesKeys.SECRET, secret)));
        try {
            return connections.createConnection(PLATFORM_TENANT, new CreateIntegrationConnectionRequest(
                    NAME, ProviderType.CAR_IMAGES, client.baseUrl(), credential.id(),
                    Map.of(CarImagesKeys.API_KEY, apiKey), null)).id();
        } catch (RuntimeException e) {
            removeCredentials(actor);
            throw e;
        }
    }

    /** @return false when no provider was set */
    public boolean delete(String actor) {
        IntegrationConnection existing = connection();
        if (existing == null) {
            return false;
        }
        connections.deleteConnection(PLATFORM_TENANT, existing.id());
        removeCredentials(actor);
        return true;
    }

    /** Checks the stored key and secret; null when no provider is set. */
    public ConnectionTestResponse test() {
        IntegrationConnection existing = connection();
        return existing == null
                ? null
                : connections.testConnection(PLATFORM_TENANT, existing.id(), new ConnectionTestRequest(null, null));
    }

    private IntegrationConnection connection() {
        return repository.findActiveByProvider(PLATFORM_TENANT, ProviderType.CAR_IMAGES);
    }

    private void removeCredentials(String actor) {
        for (CredentialProfileResponse credential : credentials.list(PLATFORM_TENANT)) {
            if (NAME.equals(credential.displayName())) {
                credentials.delete(PLATFORM_TENANT, actor, credential.id(), true);
            }
        }
    }

    private PlatformVehicleImagesView view(IntegrationConnection connection) {
        Object apiKey = connection.metadata() == null ? null : connection.metadata().get(CarImagesKeys.API_KEY);
        CredentialProfileResponse credential = connection.credentialProfileId() == null
                ? null
                : credentials.get(PLATFORM_TENANT, connection.credentialProfileId());
        return new PlatformVehicleImagesView(true, connection.id(), apiKey instanceof String s ? s : null,
                credential == null ? null : credential.secretPreview(),
                connection.status() == null ? null : connection.status().name(),
                connection.lastTestedAt(), connection.lastTestResult());
    }
}

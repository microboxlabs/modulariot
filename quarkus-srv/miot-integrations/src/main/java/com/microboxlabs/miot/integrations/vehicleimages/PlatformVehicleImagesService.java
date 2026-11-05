package com.microboxlabs.miot.integrations.vehicleimages;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.PlatformConnectionStore;
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
    private final PlatformConnectionStore store;
    private final CarImagesClient client;

    @Inject
    public PlatformVehicleImagesService(IntegrationConnectionService connections,
            IntegrationConnectionRepository repository, CredentialProfileService credentials,
            CarImagesClient client) {
        this.connections = connections;
        this.store = new PlatformConnectionStore(connections, repository, credentials, ProviderType.CAR_IMAGES,
                NAME);
        this.client = client;
    }

    public PlatformVehicleImagesView get() {
        IntegrationConnection connection = store.find();
        return connection == null ? PlatformVehicleImagesView.none() : view(connection);
    }

    /**
     * Saves the key and secret and tests them right away, so the status describes what is in use.
     *
     * @throws IllegalArgumentException for a missing key, or a missing secret on first save
     * @throws IllegalStateException when a new secret has no credential to go to
     */
    public PlatformVehicleImagesView put(SetPlatformVehicleImagesRequest body, String actor) {
        String apiKey = body == null || body.apiKey() == null ? "" : body.apiKey().trim();
        String secret = body == null || body.apiSecret() == null ? "" : body.apiSecret().trim();
        if (apiKey.isEmpty()) {
            throw new IllegalArgumentException("apiKey is required");
        }
        IntegrationConnection existing = store.find();
        String connectionId = existing == null ? create(apiKey, secret, actor) : existing.id();
        if (existing != null) {
            if (!secret.isEmpty()) {
                store.rotateSecret(existing, Map.of(CarImagesKeys.SECRET, secret));
            }
            connections.updateConnection(PLATFORM_TENANT, connectionId, new UpdateIntegrationConnectionRequest(
                    null, client.baseUrl(), Map.of(CarImagesKeys.API_KEY, apiKey), null, null));
        }
        store.test(connectionId);
        return get();
    }

    private String create(String apiKey, String secret, String actor) {
        if (secret.isEmpty()) {
            throw new IllegalArgumentException("apiSecret is required");
        }
        return store.create(AuthType.API_KEY_HEADER, Map.of("name", CarImagesKeys.SECRET_HEADER),
                Map.of(CarImagesKeys.SECRET, secret), client.baseUrl(), Map.of(CarImagesKeys.API_KEY, apiKey),
                actor);
    }

    /** @return false when no provider was set */
    public boolean delete(String actor) {
        return store.delete(actor);
    }

    /** Checks the stored key and secret; null when no provider is set. */
    public ConnectionTestResponse test() {
        return store.test();
    }

    private PlatformVehicleImagesView view(IntegrationConnection connection) {
        Object apiKey = connection.metadata() == null ? null : connection.metadata().get(CarImagesKeys.API_KEY);
        return new PlatformVehicleImagesView(true, connection.id(), apiKey instanceof String s ? s : null,
                store.secretPreview(connection),
                connection.status() == null ? null : connection.status().name(),
                connection.lastTestedAt(), connection.lastTestResult());
    }
}

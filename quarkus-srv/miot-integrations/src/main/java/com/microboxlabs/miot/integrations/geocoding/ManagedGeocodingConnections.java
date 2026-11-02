package com.microboxlabs.miot.integrations.geocoding;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.ManagedCredentials;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import com.microboxlabs.miot.integrations.service.ManagedConnectionLock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * An organization's {@code GEOCODING} connection to the platform's provider. A platform owner creates it; its
 * credential is managed ({@code managed: true}, no secret). The geocoder takes the provider, the token and the cost
 * from the platform's connection. Blocking.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class ManagedGeocodingConnections {

    static final String NAME = "Geocoding · ModularIoT";

    /** The platform tenant uses the platform's connection; it cannot hold a managed one too. */
    public static class PlatformTenantException extends IllegalArgumentException {
        PlatformTenantException() {
            super("The platform uses its own geocoding provider connection");
        }
    }

    /** There is no platform provider to connect to. */
    public static class NoPlatformProviderException extends IllegalStateException {
        NoPlatformProviderException() {
            super("Set the platform's geocoding provider in Settings › Connections, under the Platform scope, first");
        }
    }

    private final IntegrationConnectionService connections;
    private final IntegrationConnectionRepository connectionRepository;
    private final CredentialProfileService credentials;
    private final CredentialProfileRepository credentialRepository;
    private final ManagedConnectionLock lock;

    @Inject
    public ManagedGeocodingConnections(IntegrationConnectionService connections,
            IntegrationConnectionRepository connectionRepository, CredentialProfileService credentials,
            CredentialProfileRepository credentialRepository, ManagedConnectionLock lock) {
        this.connections = connections;
        this.connectionRepository = connectionRepository;
        this.credentials = credentials;
        this.credentialRepository = credentialRepository;
        this.lock = lock;
    }

    /**
     * Idempotent: an organization keeps one managed geocoding connection. A {@code GEOCODING} connection the
     * platform does not manage can never be used, so it is removed.
     *
     * @throws PlatformTenantException for the platform tenant
     * @throws NoPlatformProviderException when the platform has no provider
     */
    public IntegrationConnection connect(String tenantCode, String actor) {
        requireOrganization(tenantCode);
        return lock.locked(tenantCode, () -> connectLocked(tenantCode, actor));
    }

    private IntegrationConnection connectLocked(String tenantCode, String actor) {
        IntegrationConnection platform = connectionRepository.findActiveByProvider(PLATFORM_TENANT,
                ProviderType.GEOCODING);
        if (platform == null) {
            throw new NoPlatformProviderException();
        }
        Optional<IntegrationConnection> existing = find(tenantCode);
        if (existing.isPresent()) {
            return existing.get();
        }
        for (IntegrationConnection other : geocoding(tenantCode)) {
            connections.deletePlatformManaged(tenantCode, other.id());
        }
        CredentialProfile credential = credentials.createManaged(tenantCode, actor, NAME, AuthType.BEARER_TOKEN,
                Map.of());
        IntegrationConnection created = connections.createPlatformManaged(tenantCode, new CreateIntegrationConnectionRequest(NAME,
                    ProviderType.GEOCODING, platform.baseUrl(), credential.id(), Map.of(), null));
        // Nothing to test on the organization's side: it works once the platform's provider does.
        IntegrationConnection active = connectionRepository.updateTestResult(tenantCode, created.id(),
                ConnectionStatus.ACTIVE, OffsetDateTime.now(java.time.ZoneOffset.UTC), true);
        return active == null ? created : active;
    }

    /** The organization's managed geocoding connection, if it has one. */
    public Optional<IntegrationConnection> find(String tenantCode) {
        return geocoding(tenantCode).stream().filter(c -> managed(tenantCode, c)).findFirst();
    }

    /** @return false when the organization had no managed geocoding connection */
    public boolean remove(String tenantCode, String actor) {
        requireOrganization(tenantCode);
        return lock.locked(tenantCode, () -> removeLocked(tenantCode, actor));
    }

    private boolean removeLocked(String tenantCode, String actor) {
        Optional<IntegrationConnection> existing = find(tenantCode);
        if (existing.isEmpty()) {
            return false;
        }
        connections.deletePlatformManaged(tenantCode, existing.get().id());
        credentials.delete(tenantCode, actor, existing.get().credentialProfileId(), true);
        return true;
    }

    private List<IntegrationConnection> geocoding(String tenantCode) {
        return connections.listConnections(tenantCode).stream()
                .filter(c -> c.providerType() == ProviderType.GEOCODING)
                .toList();
    }

    private boolean managed(String tenantCode, IntegrationConnection connection) {
        if (connection.credentialProfileId() == null) {
            return false;
        }
        CredentialProfile credential =
                credentialRepository.findByTenantAndId(tenantCode, connection.credentialProfileId());
        return credential != null && ManagedCredentials.isManaged(credential.publicConfig());
    }

    private static void requireOrganization(String tenantCode) {
        if (PLATFORM_TENANT.equals(tenantCode)) {
            throw new PlatformTenantException();
        }
    }
}

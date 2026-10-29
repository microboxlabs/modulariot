package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationEventBindingRepository;
import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Delete guard + soft-delete, and credential swap on update — the P3 instance-management ops. */
class IntegrationConnectionManagementTest {

    private static final String TENANT = "tenant-1";

    private final FakeConnections connections = new FakeConnections();
    private final FakeBindings bindings = new FakeBindings();
    private final FakeCredentials credentials = new FakeCredentials();

    private IntegrationConnectionService service() {
        return new IntegrationConnectionService(null, credentials, connections, null, null, bindings, null);
    }

    @Test
    void deleteSucceedsWhenNoBindings() {
        bindings.count = 0;
        connections.present = true;

        assertTrue(service().deleteConnection(TENANT, "conn-1"));
        assertTrue(connections.softDeleted);
    }

    @Test
    void deleteRefusedWhileBindingsExist() {
        bindings.count = 2;

        IllegalStateException error = assertThrows(
                IllegalStateException.class, () -> service().deleteConnection(TENANT, "conn-1"));
        assertTrue(error.getMessage().contains("2 active binding"));
        // The guard runs before the delete, so nothing was removed.
        assertFalse(connections.softDeleted);
    }

    @Test
    void deleteMissingConnectionReturnsFalse() {
        bindings.count = 0;
        connections.present = false;

        assertFalse(service().deleteConnection(TENANT, "conn-1"));
    }

    @Test
    void updateSwapsTheCredential() {
        IntegrationConnection updated = service().updateConnection(
                TENANT,
                "conn-1",
                new UpdateIntegrationConnectionRequest("Partner QA", null, null, "cred-new", null));

        assertEquals("cred-new", connections.updatedCredentialId);
        assertNotNull(updated);
    }

    @Test
    void updatingSecretsWhileSwappingCredentialsUpdatesTheNewCredential() {
        service().updateConnection(TENANT, "conn-1", new UpdateIntegrationConnectionRequest(
                null, null, null, "cred-new", null, Map.of("app_secret", "example-signing-key")));

        assertEquals("cred-new", credentials.updatedId);
        assertEquals(Map.of("app_secret", "example-signing-key"), credentials.updates);
    }

    @Test
    void anOrganizationCannotCreateAGeocodingConnection() {
        PlatformOnlyProviderException error = assertThrows(PlatformOnlyProviderException.class,
                () -> service().createConnection(TENANT, new CreateIntegrationConnectionRequest(
                        "Mapbox", ProviderType.GEOCODING, null, "cred-1", Map.of(), null)));

        assertTrue(error.getMessage().startsWith("GEOCODING connections are managed by the platform"));
        assertNull(connections.created);
    }

    @Test
    void anOrganizationCannotChangeAGeocodingConnection() {
        connections.providerType = ProviderType.GEOCODING;

        assertThrows(PlatformOnlyProviderException.class, () -> service().updateConnection(TENANT, "conn-1",
                new UpdateIntegrationConnectionRequest(null, null, Map.of("costPerRequestUsd", "0"), null, null)));
        assertNull(connections.updatedCredentialId);
    }

    @Test
    void anOrganizationCannotDeleteOrTestAGeocodingConnection() {
        connections.providerType = ProviderType.GEOCODING;

        assertThrows(PlatformOnlyProviderException.class, () -> service().deleteConnection(TENANT, "conn-1"));
        assertThrows(PlatformOnlyProviderException.class, () -> service().testConnection(TENANT, "conn-1", null));
        assertThrows(PlatformOnlyProviderException.class, () -> service().testDraft(TENANT,
                new CreateIntegrationConnectionRequest("Mapbox", ProviderType.GEOCODING, null, null, null, null)));
        assertFalse(connections.softDeleted);
    }

    @Test
    void thePlatformManagesAnOrganizationGeocodingConnection() {
        IntegrationConnection created = service().createPlatformManaged(TENANT, new CreateIntegrationConnectionRequest(
                "Geocoding", ProviderType.GEOCODING, null, "cred-1", Map.of(), null));
        connections.providerType = ProviderType.GEOCODING;

        assertEquals(TENANT, created.tenantCode());
        assertTrue(service().deletePlatformManaged(TENANT, "conn-1"));
        assertTrue(connections.softDeleted);
    }

    @Test
    void thePlatformCreatesItsGeocodingConnection() {
        IntegrationConnection created = service().createConnection(PlatformMailService.PLATFORM_TENANT,
                new CreateIntegrationConnectionRequest("Mapbox", ProviderType.GEOCODING, null, "cred-1", Map.of(),
                        null));

        assertEquals(ProviderType.GEOCODING, created.providerType());
    }

    /* ---- fakes ---- */

    private static final class FakeConnections extends IntegrationConnectionRepository {
        private boolean present = true;
        private boolean softDeleted;
        private String updatedCredentialId;
        private IntegrationConnection created;
        private ProviderType providerType = ProviderType.CUSTOM_HTTP;

        private FakeConnections() {
            super(null);
        }

        @Override
        public IntegrationConnection findByTenantAndId(String tenantCode, String connectionId) {
            return present ? stub(providerType) : null;
        }

        @Override
        public IntegrationConnection create(IntegrationConnection connection) {
            created = connection;
            return connection;
        }

        @Override
        public IntegrationConnection update(
                String tenantCode, String connectionId, String name, String baseUrl,
                String credentialProfileId, Map<String, Object> metadata) {
            updatedCredentialId = credentialProfileId;
            return stub(providerType);
        }

        @Override
        public boolean softDelete(String tenantCode, String connectionId) {
            softDeleted = present;
            return present;
        }

        private static IntegrationConnection stub(ProviderType providerType) {
            return new IntegrationConnection(
                    "conn-1", TENANT, "Partner QA", providerType,
                    URI.create("https://qa.example.com"), "cred-old", ConnectionStatus.ACTIVE,
                    null, null, Map.of(), "tmpl-1");
        }
    }

    private static final class FakeBindings extends IntegrationEventBindingRepository {
        private int count;

        private FakeBindings() {
            super(null);
        }

        @Override
        public int countByConnection(String connectionId) {
            return count;
        }
    }

    private static final class FakeCredentials extends CredentialProfileService {
        private String updatedId;
        private Map<String, Object> updates;

        private FakeCredentials() {
            super(null, null, null, null);
        }

        @Override
        public CredentialProfile mergeSecret(String tenantCode, String id, Map<String, Object> values) {
            updatedId = id;
            updates = values;
            return new CredentialProfile(id, tenantCode, "Example", null, null, null,
                    Map.of(), null, null, 1, null, null, null, null, null, null);
        }
    }
}

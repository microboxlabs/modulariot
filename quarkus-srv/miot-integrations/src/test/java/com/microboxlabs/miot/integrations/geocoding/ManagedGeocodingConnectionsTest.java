package com.microboxlabs.miot.integrations.geocoding;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationEventBindingRepository;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.ManagedCredentials;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ManagedGeocodingConnectionsTest {

    private static final String TENANT = "acme";
    private static final String ACTOR = "owner@example.test";
    private static final URI MAPBOX = URI.create("https://api.mapbox.com");

    private final Connections connections = new Connections();
    private final Credentials credentials = new Credentials();

    private ManagedGeocodingConnections service() {
        CredentialProfileService credentialService = new CredentialProfileService(credentials, connections,
                new IntegrationSecretCipher(new ObjectMapper(), "unit-test-key"), null);
        IntegrationConnectionService connectionService = new IntegrationConnectionService(credentials,
                credentialService, connections, null, null, new NoBindings(), null);
        return new ManagedGeocodingConnections(connectionService, connections, credentialService, credentials,
                new com.microboxlabs.miot.integrations.service.TestManagedConnectionLock());
    }

    private void platformProvider() {
        connections.rows.add(new IntegrationConnection("platform-geo", PLATFORM_TENANT, "Platform geocoding",
                ProviderType.GEOCODING, MAPBOX, "platform-cred", ConnectionStatus.ACTIVE, null, null, Map.of()));
    }

    @Test
    void connectsOnceWithAManagedCredentialAndNoSecret() {
        platformProvider();

        IntegrationConnection first = service().connect(TENANT, ACTOR);
        IntegrationConnection second = service().connect(TENANT, ACTOR);

        assertEquals(first.id(), second.id());
        assertEquals(ProviderType.GEOCODING, first.providerType());
        assertEquals(TENANT, first.tenantCode());
        assertEquals(ConnectionStatus.ACTIVE, first.status());
        assertEquals(Map.of(), first.metadata());
        assertEquals(1, credentials.rows.size());
        CredentialProfile credential = credentials.rows.get(0);
        assertTrue(ManagedCredentials.isManaged(credential.publicConfig()));
        assertEquals("none", credential.secretPreview());
        assertEquals(credential.id(), first.credentialProfileId());
    }

    @Test
    void refusesWithoutAPlatformProvider() {
        assertThrows(ManagedGeocodingConnections.NoPlatformProviderException.class,
                () -> service().connect(TENANT, ACTOR));
        assertTrue(credentials.rows.isEmpty());
    }

    @Test
    void refusesThePlatformTenant() {
        platformProvider();

        assertThrows(ManagedGeocodingConnections.PlatformTenantException.class,
                () -> service().connect(PLATFORM_TENANT, ACTOR));
    }

    @Test
    void replacesAGeocodingConnectionThePlatformDoesNotManage() {
        platformProvider();
        connections.rows.add(new IntegrationConnection("own", TENANT, "Mine", ProviderType.GEOCODING, MAPBOX,
                null, ConnectionStatus.ACTIVE, null, null, Map.of()));

        IntegrationConnection created = service().connect(TENANT, ACTOR);

        assertEquals(List.of(created.id()), connections.listByTenant(TENANT).stream()
                .filter(c -> c.providerType() == ProviderType.GEOCODING).map(IntegrationConnection::id).toList());
    }

    @Test
    void removesTheConnectionAndItsCredential() {
        platformProvider();
        service().connect(TENANT, ACTOR);

        assertTrue(service().remove(TENANT, ACTOR));
        assertTrue(service().find(TENANT).isEmpty());
        assertTrue(credentials.rows.isEmpty());
        assertFalse(service().remove(TENANT, ACTOR));
    }

    /* ---- fakes ---- */

    private static final class Connections extends IntegrationConnectionRepository {
        final List<IntegrationConnection> rows = new ArrayList<>();

        Connections() {
            super(null);
        }

        @Override
        public List<IntegrationConnection> listByTenant(String tenantCode) {
            return rows.stream().filter(c -> c.tenantCode().equals(tenantCode)).toList();
        }

        @Override
        public IntegrationConnection create(IntegrationConnection connection) {
            rows.add(connection);
            return connection;
        }

        @Override
        public IntegrationConnection findByTenantAndId(String tenantCode, String id) {
            return listByTenant(tenantCode).stream().filter(c -> c.id().equals(id)).findFirst().orElse(null);
        }

        @Override
        public IntegrationConnection findActiveByProvider(String tenantCode, ProviderType providerType) {
            return listByTenant(tenantCode).stream().filter(c -> c.providerType() == providerType).findFirst()
                    .orElse(null);
        }

        @Override
        public boolean softDelete(String tenantCode, String id) {
            return rows.removeIf(c -> c.tenantCode().equals(tenantCode) && c.id().equals(id));
        }

        @Override
        public IntegrationConnection updateTestResult(String tenantCode, String id, ConnectionStatus status,
                OffsetDateTime testedAt, Boolean result) {
            IntegrationConnection c = findByTenantAndId(tenantCode, id);
            IntegrationConnection updated = new IntegrationConnection(c.id(), c.tenantCode(), c.name(),
                    c.providerType(), c.baseUrl(), c.credentialProfileId(), status, testedAt, result, c.metadata(),
                    c.templateId());
            rows.set(rows.indexOf(c), updated);
            return updated;
        }

        @Override
        public List<IntegrationConnection> listByCredentialProfiles(String tenantCode,
                Collection<String> ids) {
            return List.of();
        }
    }

    private static final class Credentials extends CredentialProfileRepository {
        final List<CredentialProfile> rows = new ArrayList<>();

        Credentials() {
            super(null);
        }

        @Override
        public List<CredentialProfile> listByTenant(String tenantCode) {
            return rows.stream().filter(c -> c.tenantCode().equals(tenantCode)).toList();
        }

        @Override
        public CredentialProfile findByTenantAndId(String tenantCode, String id) {
            return listByTenant(tenantCode).stream().filter(c -> c.id().equals(id)).findFirst().orElse(null);
        }

        @Override
        public CredentialProfile create(CredentialProfile profile) {
            rows.add(profile);
            return profile;
        }

        @Override
        public boolean softDelete(String tenantCode, String id, String deletedBy) {
            return rows.removeIf(c -> c.tenantCode().equals(tenantCode) && c.id().equals(id));
        }
    }

    private static final class NoBindings extends IntegrationEventBindingRepository {
        NoBindings() {
            super(null);
        }

        @Override
        public int countByConnection(String connectionId) {
            return 0;
        }
    }
}

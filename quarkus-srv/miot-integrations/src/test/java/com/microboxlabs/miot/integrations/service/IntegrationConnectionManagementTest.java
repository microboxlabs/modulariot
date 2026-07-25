package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
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

    private IntegrationConnectionService service() {
        return new IntegrationConnectionService(null, null, connections, null, null, bindings, null);
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

    /* ---- fakes ---- */

    private static final class FakeConnections extends IntegrationConnectionRepository {
        private boolean present = true;
        private boolean softDeleted;
        private String updatedCredentialId;

        private FakeConnections() {
            super(null);
        }

        @Override
        public IntegrationConnection findByTenantAndId(String tenantCode, String connectionId) {
            return present ? stub() : null;
        }

        @Override
        public IntegrationConnection update(
                String tenantCode, String connectionId, String name, String baseUrl,
                String credentialProfileId, Map<String, Object> metadata) {
            updatedCredentialId = credentialProfileId;
            return stub();
        }

        @Override
        public boolean softDelete(String tenantCode, String connectionId) {
            softDeleted = present;
            return present;
        }

        private static IntegrationConnection stub() {
            return new IntegrationConnection(
                    "conn-1", TENANT, "Partner QA", ProviderType.CUSTOM_HTTP,
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
}

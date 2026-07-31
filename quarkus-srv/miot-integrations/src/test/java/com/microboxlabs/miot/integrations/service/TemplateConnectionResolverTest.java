package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TemplateConnectionResolverTest {

    private static final String TENANT = "tenant-1";
    private static final String TEMPLATE = "ams";

    private final FakeConnections connections = new FakeConnections();

    private TemplateConnectionResolver resolver() {
        return new TemplateConnectionResolver(connections);
    }

    private static IntegrationConnection connection(String id, String credentialProfileId) {
        return new IntegrationConnection(
                id,
                TENANT,
                "AMS reference data",
                ProviderType.POSTGREST,
                URI.create("https://example.invalid/api/v1"),
                credentialProfileId,
                ConnectionStatus.ACTIVE,
                null,
                null,
                Map.of(),
                "template-1");
    }

    @Test
    void resolvesTheTenantsInstanceOfTheTemplate() {
        IntegrationConnection stored = connection("conn-1", "cred-1");
        connections.result = stored;

        var resolved = resolver().resolve(TENANT, TEMPLATE);

        assertTrue(resolved.isPresent());
        assertSame(stored, resolved.get());
        assertEquals(List.of(TENANT + "/" + TEMPLATE), connections.lookups);
    }

    @Test
    void returnsEmptyWhenTheTenantHasNoInstanceYet() {
        connections.result = null;

        // The normal state during rollout: the caller keeps its previous credential rather than
        // failing, so an unmigrated tenant is not broken by this lookup existing.
        assertTrue(resolver().resolve(TENANT, TEMPLATE).isEmpty());
    }

    @Test
    void asksTheRepositoryForTheCallersOwnTenant() {
        connections.result = null;

        resolver().resolve("other-tenant", TEMPLATE);

        // The tenant is passed straight through: one tenant must never resolve to another's
        // connection, and the repository's query is what enforces it.
        assertEquals(List.of("other-tenant/" + TEMPLATE), connections.lookups);
    }

    @Test
    void treatsABlankTemplateNameAsUnresolved() {
        connections.result = connection("conn-1", "cred-1");

        // Guarded in the repository rather than here, so a caller with an unset config value
        // gets the fallback path instead of an arbitrary connection.
        assertTrue(new TemplateConnectionResolver(new BlankGuardingConnections())
                .resolve(TENANT, "")
                .isEmpty());
    }

    /** Records what was asked for, so tenant scoping can be asserted without a database. */
    private static class FakeConnections extends IntegrationConnectionRepository {
        private final List<String> lookups = new ArrayList<>();
        private IntegrationConnection result;

        private FakeConnections() {
            super(null);
        }

        @Override
        public IntegrationConnection findActiveByTemplateName(
                String tenantCode, String templateName) {
            lookups.add(tenantCode + "/" + templateName);
            return result;
        }
    }

    /** The real blank-name guard, exercised without a pool. */
    private static final class BlankGuardingConnections extends IntegrationConnectionRepository {
        private BlankGuardingConnections() {
            super(null);
        }
    }
}

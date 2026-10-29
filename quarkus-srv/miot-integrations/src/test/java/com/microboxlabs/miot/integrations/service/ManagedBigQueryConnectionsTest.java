package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.orgaccount.OrgServiceAccount;
import com.microboxlabs.miot.integrations.orgaccount.OrgServiceAccountService;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ManagedBigQueryConnectionsTest {
    @Test
    void retriesAfterOnlyTheCredentialWasCreated() {
        OrgServiceAccount account = new OrgServiceAccount("tenant-demo", "project-demo", "t-demo",
                "t-demo@project-demo.iam.gserviceaccount.com", "123", false, null, "owner", null, "owner");
        OrgServiceAccountService accounts = new OrgServiceAccountService(null, Optional.of("project-demo"), "t-") {
            @Override
            public OrgServiceAccount create(String tenant, String slug, String name, String actor) {
                return account;
            }
            @Override
            public void allowQueries(String tenant) { }
        };
        CredentialProfile credential = new CredentialProfile("credential-demo", "tenant-demo", "Managed",
                CredentialType.GOOGLE_SERVICE_ACCOUNT, AuthType.GOOGLE_SERVICE_ACCOUNT, "DEFAULT",
                Map.of("managed", true), "encrypted", "masked", 1, null, null, null, null, "owner", "owner");
        CredentialProfileRepository repository = new CredentialProfileRepository(null) {
            @Override
            public List<CredentialProfile> listByTenant(String tenant) {
                assertEquals("tenant-demo", tenant);
                return List.of(credential);
            }
        };
        CredentialProfileService credentials = new CredentialProfileService(null, null, null, null) {
            @Override
            public CredentialProfile createManaged(String tenant, String actor, String name, Map<String, Object> config) {
                throw new AssertionError("The existing managed credential must be reused");
            }
        };
        IntegrationConnection connection = new IntegrationConnection("connection-demo", "tenant-demo", "Managed",
                ProviderType.CUSTOM_HTTP, URI.create(BigQueryProbe.BASE_URL), "credential-demo", ConnectionStatus.ACTIVE,
                null, true, Map.of());
        IntegrationConnectionService connections = new IntegrationConnectionService(null, null, null, null, null, null, null) {
            @Override
            public List<IntegrationConnection> listConnections(String tenant) { return List.of(); }
            @Override
            public IntegrationConnection createConnection(String tenant, CreateIntegrationConnectionRequest request) {
                assertEquals("credential-demo", request.credentialProfileId());
                return connection;
            }
            @Override
            public IntegrationConnection getConnection(String tenant, String id) { return connection; }
            @Override
            public ConnectionTestResponse testConnection(String tenant, String id, ConnectionTestRequest request) {
                return new ConnectionTestResponse(true, null, "Synthetic success");
            }
        };
        ManagedConnectionLock lock = new ManagedConnectionLock((java.util.function.Supplier<io.vertx.mutiny.sqlclient.Pool>) null) {
            @Override
            public <T> T locked(String tenant, java.util.function.Supplier<T> work) {
                assertEquals("tenant-demo", tenant);
                return work.get();
            }
        };
        ManagedBigQueryConnections service = new ManagedBigQueryConnections(accounts, credentials, repository, connections, lock);
        assertSame(connection, service.create("tenant-demo", "demo", "Demo", "owner").connection());
    }
}

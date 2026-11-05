package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.tester.ConnectionTester;
import com.microboxlabs.miot.integrations.tester.ConnectionTesterRegistry;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Draft tests may read a tenant's credential, but must never touch persistence writers. */
class DraftConnectionTest {
    private static final String TENANT = "demo-tenant";
    private boolean missingCredential;
    private int probes;

    @Test
    void testsTheUnsavedSnapshotWithoutPersistingConnectionOrCredentialStatus() {
        var result = service().testDraft(TENANT, request());
        assertTrue(result.success());
        assertEquals(1, probes);
    }

    @Test
    void refusesACredentialNotOwnedByTheTenantWithoutProbing() {
        missingCredential = true;
        assertFalse(service().testDraft(TENANT, request()).success());
        assertEquals(0, probes);
    }

    private static CreateIntegrationConnectionRequest request() {
        return new CreateIntegrationConnectionRequest("Demo", ProviderType.CUSTOM_HTTP,
                URI.create("https://bigquery.googleapis.com"), "demo-credential", Map.of(), null);
    }

    private IntegrationConnectionService service() {
        var credentials = new CredentialProfileRepository(null) {
            @Override
            public CredentialProfile findByTenantAndId(String tenantCode, String id) {
                assertEquals(TENANT, tenantCode);
                assertEquals("demo-credential", id);
                return missingCredential ? null : new CredentialProfile(id, tenantCode, "Demo", null,
                        AuthType.GOOGLE_SERVICE_ACCOUNT, "DEVELOPMENT", Map.of(), "{}", "****", 1,
                        null, null, null, null, null, null);
            }
        };
        var testers = new ConnectionTesterRegistry(null, null) {
            @Override
            public ConnectionTester testerFor(IntegrationConnection connection) {
                assertTrue(connection.isDraft());
                assertEquals(ConnectionStatus.DRAFT, connection.status());
                assertEquals(TENANT, connection.tenantCode());
                assertEquals(request().baseUrl(), connection.baseUrl());
                return new ConnectionTester() {
                    @Override
                    public boolean supports(ProviderType type) { return true; }
                    @Override
                    public ConnectionTestResponse test(IntegrationConnection draft, CredentialProfile credential,
                            ConnectionTestRequest ignored) {
                        assertEquals("demo-credential", credential.id());
                        probes++;
                        return new ConnectionTestResponse(true, OffsetDateTime.now(), "Demo passed");
                    }
                };
            }
        };
        // Writers are deliberately absent: persisting anything must fail this test.
        return new IntegrationConnectionService(credentials, null, null, null, null, null, testers);
    }
}

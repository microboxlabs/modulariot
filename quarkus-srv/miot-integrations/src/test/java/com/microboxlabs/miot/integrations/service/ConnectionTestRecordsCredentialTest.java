package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.tester.ConnectionTester;
import com.microboxlabs.miot.integrations.tester.ConnectionTesterRegistry;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** A connection test also records its result on the connection's credential. */
class ConnectionTestRecordsCredentialTest {

    private static final String TENANT = "tenant-1";
    private static final OffsetDateTime AT = OffsetDateTime.parse("2026-10-24T12:00:00Z");

    private final List<String> credentialResults = new ArrayList<>();
    private String credentialId = "cred-1";
    private boolean succeeds = true;
    private boolean validates = true;

    @Test
    void aContractOnlyCheckLeavesTheCredentialAlone() {
        validates = false;

        service().testConnection(TENANT, "conn-1", new ConnectionTestRequest(null, null));

        assertTrue(credentialResults.isEmpty());
    }

    @Test
    void aPassingTestIsRecordedOnTheCredential() {
        service().testConnection(TENANT, "conn-1", new ConnectionTestRequest(null, null));

        assertEquals(List.of("cred-1 " + AT + " true"), credentialResults);
    }

    @Test
    void aFailingTestIsRecordedOnTheCredential() {
        succeeds = false;

        service().testConnection(TENANT, "conn-1", new ConnectionTestRequest(null, null));

        assertEquals(List.of("cred-1 " + AT + " false"), credentialResults);
    }

    @Test
    void aConnectionWithoutACredentialRecordsNothingElse() {
        credentialId = null;

        service().testConnection(TENANT, "conn-1", new ConnectionTestRequest(null, null));

        assertTrue(credentialResults.isEmpty());
    }

    private IntegrationConnectionService service() {
        return new IntegrationConnectionService(new FakeCredentials(), null, new FakeConnections(), null, null, null,
                new FakeTesters());
    }

    private final class FakeConnections extends IntegrationConnectionRepository {
        FakeConnections() {
            super(null);
        }

        @Override
        public IntegrationConnection findByTenantAndId(String tenantCode, String connectionId) {
            return new IntegrationConnection(connectionId, tenantCode, "WhatsApp", ProviderType.WHATSAPP,
                    URI.create("https://graph.example.test"), credentialId, ConnectionStatus.DRAFT, null, null,
                    Map.of());
        }

        @Override
        public IntegrationConnection updateTestResult(String tenantCode, String connectionId,
                ConnectionStatus status, OffsetDateTime testedAt, Boolean testResult) {
            return null;
        }
    }

    private final class FakeCredentials extends CredentialProfileRepository {
        FakeCredentials() {
            super(null);
        }

        @Override
        public CredentialProfile findByTenantAndId(String tenantCode, String id) {
            return new CredentialProfile(id, tenantCode, "WhatsApp token", null, AuthType.BEARER_TOKEN, null,
                    Map.of(), "{}", "****", 1, null, null, null, null, null, null);
        }

        @Override
        public CredentialProfile updateTestResult(String tenantCode, String id, OffsetDateTime testedAt,
                Boolean testResult) {
            credentialResults.add(id + " " + testedAt + " " + testResult);
            return null;
        }
    }

    private final class FakeTesters extends ConnectionTesterRegistry {
        FakeTesters() {
            super(null, null);
        }

        @Override
        public ConnectionTester testerFor(ProviderType providerType) {
            return new ConnectionTester() {
                @Override
                public boolean supports(ProviderType type) {
                    return true;
                }

                @Override
                public ConnectionTestResponse test(IntegrationConnection connection, CredentialProfile credential,
                        ConnectionTestRequest request) {
                    return new ConnectionTestResponse(succeeds, AT, succeeds ? "ok" : "HTTP 401");
                }

                @Override
                public boolean validatesCredential() {
                    return validates;
                }
            };
        }
    }
}

package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationOperationRequest;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.tester.ConnectionTesterRegistry;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class IntegrationConnectionService {

    private final CredentialProfileRepository credentialProfileRepository;
    private final CredentialProfileService credentialProfileService;
    private final IntegrationConnectionRepository connectionRepository;
    private final IntegrationOperationRepository operationRepository;
    private final ConnectionTesterRegistry testerRegistry;

    @Inject
    public IntegrationConnectionService(
            CredentialProfileRepository credentialProfileRepository,
            CredentialProfileService credentialProfileService,
            IntegrationConnectionRepository connectionRepository,
            IntegrationOperationRepository operationRepository,
            ConnectionTesterRegistry testerRegistry) {
        this.credentialProfileRepository = credentialProfileRepository;
        this.credentialProfileService = credentialProfileService;
        this.connectionRepository = connectionRepository;
        this.operationRepository = operationRepository;
        this.testerRegistry = testerRegistry;
    }

    public List<IntegrationConnection> listConnections(String tenantCode) {
        return connectionRepository.listByTenant(tenantCode);
    }

    public IntegrationConnection createConnection(String tenantCode, CreateIntegrationConnectionRequest req) {
        IntegrationConnection connection = new IntegrationConnection(
                UUID.randomUUID().toString(),
                tenantCode,
                req.name(),
                req.providerType(),
                req.baseUrl(),
                req.credentialProfileId(),
                ConnectionStatus.DRAFT,
                null,
                null,
                safeMap(req.metadata()));
        return connectionRepository.create(connection);
    }

    public IntegrationConnection getConnection(String tenantCode, String connectionId) {
        return connectionRepository.findByTenantAndId(tenantCode, connectionId);
    }

    /**
     * Partial update of a connection. Returns {@code null} if the connection does not exist.
     * A non-blank {@code token} rotates the secret on the linked credential profile.
     */
    public IntegrationConnection updateConnection(
            String tenantCode, String connectionId, UpdateIntegrationConnectionRequest req) {
        IntegrationConnection existing = connectionRepository.findByTenantAndId(tenantCode, connectionId);
        if (existing == null) {
            return null;
        }
        rotateTokenIfPresent(tenantCode, existing, req.token());
        String baseUrl = req.baseUrl() == null ? null : req.baseUrl().toString();
        return connectionRepository.update(tenantCode, connectionId, req.name(), baseUrl, req.metadata());
    }

    /**
     * Rotates the linked credential's secret when a non-blank token is supplied.
     * Fails (does not silently drop the token) when there is no resolvable credential,
     * so the rotation is part of the update's success contract.
     */
    private void rotateTokenIfPresent(String tenantCode, IntegrationConnection existing, String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        CredentialProfile rotated = existing.credentialProfileId() == null
                ? null
                : credentialProfileService.rotateSecret(
                        tenantCode, existing.credentialProfileId(), Map.of("token", token));
        if (rotated == null) {
            throw new IllegalStateException(
                    "Cannot rotate the access token: the connection has no resolvable credential profile");
        }
    }

    public IntegrationOperation addOperation(
            String tenantCode,
            String connectionId,
            CreateIntegrationOperationRequest req) {
        IntegrationConnection connection = getConnection(tenantCode, connectionId);
        if (connection == null) {
            return null;
        }
        IntegrationOperation operation = new IntegrationOperation(
                UUID.randomUUID().toString(),
                connectionId,
                req.name(),
                req.method(),
                req.path(),
                safeMap(req.requestSchema()),
                safeMap(req.responseSchema()),
                req.testOperation());
        return operationRepository.create(operation);
    }

    public List<IntegrationOperation> listOperations(String tenantCode, String connectionId) {
        if (getConnection(tenantCode, connectionId) == null) {
            return List.of();
        }
        return operationRepository.listByConnection(connectionId);
    }

    public ConnectionTestResponse testConnection(
            String tenantCode,
            String connectionId,
            ConnectionTestRequest req) {
        IntegrationConnection connection = getConnection(tenantCode, connectionId);
        if (connection == null) {
            return new ConnectionTestResponse(false, OffsetDateTime.now(), "Connection not found");
        }

        CredentialProfile credential = connection.credentialProfileId() == null
                ? null
                : credentialProfileRepository.findByTenantAndId(tenantCode, connection.credentialProfileId());

        ConnectionTestResponse response = testerRegistry.testerFor(connection.providerType())
                .test(connection, credential, req);

        ConnectionStatus status = response.success() ? ConnectionStatus.ACTIVE : ConnectionStatus.TEST_FAILED;
        connectionRepository.updateTestResult(
                connection.tenantCode(), connection.id(), status, response.testedAt(), response.success());
        return response;
    }

    private Map<String, Object> safeMap(Map<String, Object> map) {
        return map == null ? Map.of() : new LinkedHashMap<>(map);
    }
}

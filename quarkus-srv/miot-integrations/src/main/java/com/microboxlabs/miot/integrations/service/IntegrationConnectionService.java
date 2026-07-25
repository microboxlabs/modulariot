package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationOperationRequest;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationTemplateRepository;
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
    private final IntegrationTemplateRepository templateRepository;
    private final ConnectionTesterRegistry testerRegistry;

    @Inject
    public IntegrationConnectionService(
            CredentialProfileRepository credentialProfileRepository,
            CredentialProfileService credentialProfileService,
            IntegrationConnectionRepository connectionRepository,
            IntegrationOperationRepository operationRepository,
            IntegrationTemplateRepository templateRepository,
            ConnectionTesterRegistry testerRegistry) {
        this.credentialProfileRepository = credentialProfileRepository;
        this.credentialProfileService = credentialProfileService;
        this.connectionRepository = connectionRepository;
        this.operationRepository = operationRepository;
        this.templateRepository = templateRepository;
        this.testerRegistry = testerRegistry;
    }

    public List<IntegrationConnection> listConnections(String tenantCode) {
        return connectionRepository.listByTenant(tenantCode);
    }

    /**
     * Creates a connection. When {@code templateId} is set, the connection is an instance of
     * that template: its provider type comes from the template, and the template's contract is
     * copied onto a freshly-provisioned operation so the dispatch path (connection + operation)
     * needs no template awareness. Without a template it is an ad-hoc connection.
     */
    public IntegrationConnection createConnection(String tenantCode, CreateIntegrationConnectionRequest req) {
        IntegrationTemplate template = req.templateId() == null
                ? null
                : templateRepository.findByTenantAndId(tenantCode, req.templateId());
        if (req.templateId() != null && template == null) {
            throw new IllegalArgumentException("Unknown integration template: " + req.templateId());
        }

        ProviderType providerType = template != null ? template.providerType() : req.providerType();
        IntegrationConnection connection = new IntegrationConnection(
                UUID.randomUUID().toString(),
                tenantCode,
                req.name(),
                providerType,
                req.baseUrl(),
                req.credentialProfileId(),
                ConnectionStatus.DRAFT,
                null,
                null,
                safeMap(req.metadata()),
                template != null ? template.id() : null);
        IntegrationConnection created = connectionRepository.create(connection);

        if (template != null) {
            provisionTemplateOperation(created.id(), template);
        }
        return created;
    }

    /**
     * Copies a template's contract onto a new instance as its operation. The instance keeps its
     * own copy (so dispatch stays connection-scoped and the UI can hold it read-only), which is
     * why a later template edit reaches only connections created after it.
     */
    private void provisionTemplateOperation(String connectionId, IntegrationTemplate template) {
        IntegrationOperation operation = new IntegrationOperation(
                UUID.randomUUID().toString(),
                connectionId,
                template.operationName(),
                template.method(),
                template.path(),
                safeMap(template.requestSchema()),
                safeMap(template.responseSchema()),
                false);
        operationRepository.create(operation);
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

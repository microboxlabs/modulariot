package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationOperationRequest;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class IntegrationConnectionService {

    private final Map<String, CredentialProfile> credentialProfiles = new ConcurrentHashMap<>();
    private final Map<String, IntegrationConnection> connections = new ConcurrentHashMap<>();
    private final Map<String, IntegrationOperation> operations = new ConcurrentHashMap<>();

    public List<CredentialProfileResponse> listCredentialProfiles(String tenantCode) {
        return credentialProfiles.values().stream()
                .filter(profile -> profile.tenantCode().equals(tenantCode))
                .map(this::toResponse)
                .toList();
    }

    public CredentialProfileResponse createCredentialProfile(String tenantCode, CreateCredentialProfileRequest req) {
        OffsetDateTime now = OffsetDateTime.now();
        CredentialProfile profile = new CredentialProfile(
                UUID.randomUUID().toString(),
                tenantCode,
                req.displayName(),
                req.authType(),
                safeMap(req.publicConfig()),
                "[pending-encryption]",
                maskSecret(req.secretConfig()),
                1,
                now,
                now);
        credentialProfiles.put(profile.id(), profile);
        return toResponse(profile);
    }

    public List<IntegrationConnection> listConnections(String tenantCode) {
        return connections.values().stream()
                .filter(connection -> connection.tenantCode().equals(tenantCode))
                .toList();
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
        connections.put(connection.id(), connection);
        return connection;
    }

    public IntegrationConnection getConnection(String tenantCode, String connectionId) {
        IntegrationConnection connection = connections.get(connectionId);
        if (connection == null || !connection.tenantCode().equals(tenantCode)) {
            return null;
        }
        return connection;
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
        operations.put(operation.id(), operation);
        return operation;
    }

    public List<IntegrationOperation> listOperations(String tenantCode, String connectionId) {
        if (getConnection(tenantCode, connectionId) == null) {
            return List.of();
        }
        return operations.values().stream()
                .filter(operation -> operation.connectionId().equals(connectionId))
                .toList();
    }

    public ConnectionTestResponse testConnection(
            String tenantCode,
            String connectionId,
            ConnectionTestRequest req) {
        IntegrationConnection connection = getConnection(tenantCode, connectionId);
        if (connection == null) {
            return new ConnectionTestResponse(false, OffsetDateTime.now(), "Connection not found");
        }

        OffsetDateTime now = OffsetDateTime.now();
        IntegrationConnection updated = new IntegrationConnection(
                connection.id(),
                connection.tenantCode(),
                connection.name(),
                connection.providerType(),
                connection.baseUrl(),
                connection.credentialProfileId(),
                ConnectionStatus.ACTIVE,
                now,
                true,
                connection.metadata());
        connections.put(updated.id(), updated);
        return new ConnectionTestResponse(true, now, "Connection contract is valid; runtime probe pending");
    }

    private CredentialProfileResponse toResponse(CredentialProfile profile) {
        return new CredentialProfileResponse(
                profile.id(),
                profile.tenantCode(),
                profile.displayName(),
                profile.authType(),
                profile.publicConfig(),
                profile.secretPreview(),
                profile.secretVersion(),
                profile.createdAt(),
                profile.updatedAt());
    }

    private Map<String, Object> safeMap(Map<String, Object> map) {
        return map == null ? Map.of() : Map.copyOf(map);
    }

    private String maskSecret(Map<String, Object> secretConfig) {
        if (secretConfig == null || secretConfig.isEmpty()) {
            return "none";
        }
        return "****";
    }
}

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
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationOperationRepository;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretEncryptionException;
import com.microboxlabs.miot.integrations.tester.ConnectionTesterRegistry;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jboss.logging.Logger;

@ApplicationScoped
public class IntegrationConnectionService {

    private static final Logger LOG = Logger.getLogger(IntegrationConnectionService.class);

    private final CredentialProfileRepository credentialProfileRepository;
    private final IntegrationConnectionRepository connectionRepository;
    private final IntegrationOperationRepository operationRepository;
    private final IntegrationSecretCipher secretCipher;
    private final ConnectionTesterRegistry testerRegistry;

    @Inject
    public IntegrationConnectionService(
            CredentialProfileRepository credentialProfileRepository,
            IntegrationConnectionRepository connectionRepository,
            IntegrationOperationRepository operationRepository,
            IntegrationSecretCipher secretCipher,
            ConnectionTesterRegistry testerRegistry) {
        this.credentialProfileRepository = credentialProfileRepository;
        this.connectionRepository = connectionRepository;
        this.operationRepository = operationRepository;
        this.secretCipher = secretCipher;
        this.testerRegistry = testerRegistry;
    }

    public List<CredentialProfileResponse> listCredentialProfiles(String tenantCode) {
        return credentialProfileRepository.listByTenant(tenantCode).stream()
                .map(this::toResponse)
                .toList();
    }

    public CredentialProfileResponse createCredentialProfile(String tenantCode, CreateCredentialProfileRequest req) {
        OffsetDateTime now = OffsetDateTime.now();
        String encryptedSecretJson = encryptSecretConfig(req);
        CredentialProfile profile = new CredentialProfile(
                UUID.randomUUID().toString(),
                tenantCode,
                req.displayName(),
                req.authType(),
                safeMap(req.publicConfig()),
                encryptedSecretJson,
                maskSecret(req.secretConfig()),
                1,
                now,
                now);
        return toResponse(credentialProfileRepository.create(profile));
    }

    private String encryptSecretConfig(CreateCredentialProfileRequest req) {
        try {
            return secretCipher.encrypt(req.secretConfig());
        } catch (IntegrationSecretEncryptionException e) {
            LOG.errorf(e, "Failed to encrypt secret config for credential profile '%s'", req.displayName());
            throw e;
        }
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
        return map == null ? Map.of() : new LinkedHashMap<>(map);
    }

    private String maskSecret(Map<String, Object> secretConfig) {
        if (secretConfig == null || secretConfig.isEmpty()) {
            return "none";
        }
        return "****";
    }
}

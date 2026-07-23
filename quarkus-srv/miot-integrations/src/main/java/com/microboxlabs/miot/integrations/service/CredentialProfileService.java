package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.auth.oauth.OAuth2CredentialConfigs;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.CredentialUsageKind;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.dto.CredentialTestRequest;
import com.microboxlabs.miot.integrations.dto.CredentialTestResponse;
import com.microboxlabs.miot.integrations.dto.CredentialUsageResponse;
import com.microboxlabs.miot.integrations.dto.UpdateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.net.OutboundUrlGuard;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.persistence.UpdateCredentialProfileParams;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretEncryptionException;
import com.microboxlabs.miot.integrations.tester.CredentialTesterRegistry;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jboss.logging.Logger;

/**
 * Credentials as a tenant-level capability: configured once, referenced from connections,
 * jobs and channels.
 *
 * <p>Blocking by design — every repository call awaits — so callers must hand it a worker
 * thread. The actor is passed in rather than injected: the resource resolves it on the
 * event loop, where the request context is still active.
 */
@ApplicationScoped
public class CredentialProfileService {

    private static final Logger LOG = Logger.getLogger(CredentialProfileService.class);

    /** Where credentials land when the caller states no environment (the WhatsApp channel doesn't). */
    static final String DEFAULT_ENVIRONMENT = "PRODUCTION";

    private static final int MAX_NAME_LENGTH = 160;
    private static final int MAX_ENVIRONMENT_LENGTH = 40;

    private final CredentialProfileRepository credentialProfileRepository;
    private final IntegrationConnectionRepository connectionRepository;
    private final IntegrationSecretCipher secretCipher;
    private final CredentialTesterRegistry testerRegistry;

    @Inject
    public CredentialProfileService(
            CredentialProfileRepository credentialProfileRepository,
            IntegrationConnectionRepository connectionRepository,
            IntegrationSecretCipher secretCipher,
            CredentialTesterRegistry testerRegistry) {
        this.credentialProfileRepository = credentialProfileRepository;
        this.connectionRepository = connectionRepository;
        this.secretCipher = secretCipher;
        this.testerRegistry = testerRegistry;
    }

    public List<CredentialProfileResponse> list(String tenantCode) {
        List<CredentialProfile> profiles = credentialProfileRepository.listByTenant(tenantCode);
        Map<String, List<CredentialUsageResponse>> usages = usagesFor(tenantCode, profiles);
        return profiles.stream()
                .map(profile -> toResponse(profile, usages.getOrDefault(profile.id(), List.of())))
                .toList();
    }

    /** @return the credential, or {@code null} when the tenant has no such active credential */
    public CredentialProfileResponse get(String tenantCode, String id) {
        CredentialProfile profile = credentialProfileRepository.findByTenantAndId(tenantCode, id);
        return profile == null
                ? null
                : toResponse(profile, usagesFor(tenantCode, List.of(profile)).getOrDefault(id, List.of()));
    }

    /**
     * @throws IllegalArgumentException when a required field is missing, the config does
     *                                  not suit the type, or the name is already taken in
     *                                  that environment
     */
    public CredentialProfileResponse create(
            String tenantCode, String actor, CreateCredentialProfileRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        // Callers that predate the credentials screen send only an auth type; derive the
        // rest so they keep working unchanged.
        CredentialType credentialType = req.credentialType() != null
                ? req.credentialType()
                : CredentialType.fromAuthType(req.authType());
        AuthType authType = req.authType() != null ? req.authType() : credentialType.defaultAuthType();

        String displayName = requireName(req.displayName());
        List<CredentialProfile> existing = credentialProfileRepository.listByTenant(tenantCode);
        String environment = resolveEnvironment(req.environment(), existing);
        requireNameAvailable(existing, displayName, environment, null);

        Map<String, Object> publicConfig = safeMap(req.publicConfig());
        Map<String, Object> secretConfig = safeMap(req.secretConfig());
        if (secretConfig.isEmpty()) {
            throw new IllegalArgumentException("secretConfig is required");
        }
        validateConfig(credentialType, publicConfig);

        OffsetDateTime now = OffsetDateTime.now();
        CredentialProfile created = credentialProfileRepository.create(new CredentialProfile(
                UUID.randomUUID().toString(),
                tenantCode,
                displayName,
                credentialType,
                authType,
                environment,
                publicConfig,
                encrypt(secretConfig, displayName),
                maskSecret(secretConfig),
                1,
                null,
                null,
                now,
                now,
                actor,
                actor));
        return toResponse(created, List.of());
    }

    /**
     * Partial update. An absent or empty {@code secretConfig} keeps the stored secret —
     * the form cannot show it, so it submits nothing to mean "leave it alone".
     *
     * @return the updated credential, or {@code null} when it does not exist
     */
    public CredentialProfileResponse update(
            String tenantCode, String actor, String id, UpdateCredentialProfileRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        CredentialProfile current = credentialProfileRepository.findByTenantAndId(tenantCode, id);
        if (current == null) {
            return null;
        }

        String displayName = req.displayName() == null ? null : requireName(req.displayName());
        List<CredentialProfile> existing = credentialProfileRepository.listByTenant(tenantCode);
        String environment = req.environment() == null ? null : resolveEnvironment(req.environment(), existing);
        requireNameAvailable(
                existing,
                displayName != null ? displayName : current.displayName(),
                environment != null ? environment : current.environment(),
                current.id());

        // The config is validated as it will end up: a caller may send only the half it
        // changed, and the stored half still has to satisfy the type.
        Map<String, Object> publicConfig = req.publicConfig() == null ? null : safeMap(req.publicConfig());
        validateConfig(current.credentialType(), publicConfig != null ? publicConfig : current.publicConfig());

        Map<String, Object> secretConfig = safeMap(req.secretConfig());
        boolean rotating = !secretConfig.isEmpty();

        CredentialProfile updated = credentialProfileRepository.update(new UpdateCredentialProfileParams(
                tenantCode,
                id,
                displayName,
                environment,
                publicConfig,
                rotating ? encrypt(secretConfig, current.displayName()) : null,
                rotating ? maskSecret(secretConfig) : null,
                actor));
        return updated == null
                ? null
                : toResponse(updated, usagesFor(tenantCode, List.of(updated)).getOrDefault(id, List.of()));
    }

    /**
     * Soft-deletes a credential.
     *
     * @param force delete even while referenced, accepting that those consumers break
     * @return false when the tenant has no such active credential
     * @throws CredentialInUseException when it is referenced and {@code force} is false
     */
    public boolean delete(String tenantCode, String actor, String id, boolean force) {
        CredentialProfile profile = credentialProfileRepository.findByTenantAndId(tenantCode, id);
        if (profile == null) {
            return false;
        }
        if (!force) {
            List<CredentialUsageResponse> usages =
                    usagesFor(tenantCode, List.of(profile)).getOrDefault(id, List.of());
            if (!usages.isEmpty()) {
                throw new CredentialInUseException(usages);
            }
        }
        return credentialProfileRepository.softDelete(tenantCode, id, actor);
    }

    /**
     * Exercises a stored credential and records the outcome on it.
     *
     * @return the result, or {@code null} when the tenant has no such active credential
     */
    public CredentialTestResponse test(String tenantCode, String id) {
        CredentialProfile profile = credentialProfileRepository.findByTenantAndId(tenantCode, id);
        if (profile == null) {
            return null;
        }
        CredentialTestResponse response = runTest(
                profile.credentialType(), profile.publicConfig(), decrypt(profile));
        credentialProfileRepository.updateTestResult(
                tenantCode, id, response.testedAt(), response.success());
        return response;
    }

    /**
     * Exercises a credential that has not been saved, so a wrong secret is caught before
     * it is stored. Nothing is persisted, and the secret is used for this one request.
     */
    public CredentialTestResponse testConfig(CredentialTestRequest req) {
        if (req == null || req.credentialType() == null) {
            throw new IllegalArgumentException("credentialType is required");
        }
        return runTest(req.credentialType(), safeMap(req.publicConfig()), safeMap(req.secretConfig()));
    }

    /**
     * Replaces a credential's secret, leaving everything else alone. The connection
     * update path uses this to rotate an access token in place.
     *
     * @return the updated credential, or {@code null} when it does not exist
     */
    public CredentialProfile rotateSecret(String tenantCode, String id, Map<String, Object> secretConfig) {
        return credentialProfileRepository.updateSecret(
                tenantCode, id, encrypt(secretConfig, id), maskSecret(secretConfig));
    }

    private CredentialTestResponse runTest(
            CredentialType type, Map<String, Object> publicConfig, Map<String, Object> secretConfig) {
        try {
            // Which hosts this deployment may reach is policy, so the guard lives here
            // rather than in the tester — and it resolves the name, so it only runs when
            // a request is actually about to go out.
            if (OAuth2CredentialConfigs.supports(type)) {
                OutboundUrlGuard.requirePublicHttpUrl(
                        OAuth2CredentialConfigs.tokenUrl(type, publicConfig), "tokenUrl");
            }
        } catch (IllegalArgumentException e) {
            return CredentialTestResponse.failure(e.getMessage());
        }
        return testerRegistry.test(type, publicConfig, secretConfig);
    }

    /** Which connections reference each of these credentials, in one query for the whole set. */
    private Map<String, List<CredentialUsageResponse>> usagesFor(
            String tenantCode, List<CredentialProfile> profiles) {
        if (profiles.isEmpty()) {
            return Map.of();
        }
        List<IntegrationConnection> connections = connectionRepository.listByCredentialProfiles(
                tenantCode, profiles.stream().map(CredentialProfile::id).toList());
        return connections.stream().collect(Collectors.groupingBy(
                IntegrationConnection::credentialProfileId,
                Collectors.mapping(
                        connection -> new CredentialUsageResponse(
                                connection.id(), connection.name(), usageKind(connection.providerType())),
                        Collectors.toList())));
    }

    private static CredentialUsageKind usageKind(ProviderType providerType) {
        return providerType == ProviderType.WHATSAPP
                ? CredentialUsageKind.CHANNEL
                : CredentialUsageKind.INTEGRATION;
    }

    private void validateConfig(CredentialType type, Map<String, Object> publicConfig) {
        if (OAuth2CredentialConfigs.supports(type)) {
            OAuth2CredentialConfigs.validatePublicConfig(type, publicConfig);
        }
    }

    /**
     * Trims and collapses inner whitespace, then reuses an existing label that differs
     * only in case, so typing "qa" joins "QA" instead of creating a twin the unique index
     * would reject anyway.
     */
    private String resolveEnvironment(String requested, List<CredentialProfile> existing) {
        String normalized = normalizeEnvironment(requested);
        if (normalized.isEmpty()) {
            return DEFAULT_ENVIRONMENT;
        }
        if (normalized.length() > MAX_ENVIRONMENT_LENGTH) {
            throw new IllegalArgumentException(
                    "environment must be at most " + MAX_ENVIRONMENT_LENGTH + " characters");
        }
        return existing.stream()
                .map(CredentialProfile::environment)
                .filter(candidate -> candidate != null && candidate.equalsIgnoreCase(normalized))
                .findFirst()
                .orElse(normalized);
    }

    static String normalizeEnvironment(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private static String requireName(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("displayName is required");
        }
        if (trimmed.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException(
                    "displayName must be at most " + MAX_NAME_LENGTH + " characters");
        }
        return trimmed;
    }

    /**
     * Pre-empts the unique index so a clash reads as a name conflict rather than a
     * database error. The index remains the guarantee under concurrent writes.
     */
    private static void requireNameAvailable(
            List<CredentialProfile> existing, String displayName, String environment, String selfId) {
        boolean taken = existing.stream().anyMatch(profile ->
                !profile.id().equals(selfId)
                        && profile.displayName().equalsIgnoreCase(displayName)
                        && profile.environment() != null
                        && profile.environment().equalsIgnoreCase(environment));
        if (taken) {
            throw new IllegalArgumentException(
                    "A credential named '" + displayName + "' already exists in " + environment);
        }
    }

    private Map<String, Object> decrypt(CredentialProfile profile) {
        return secretCipher.decrypt(profile.encryptedSecretJson());
    }

    private String encrypt(Map<String, Object> secretConfig, String context) {
        try {
            return secretCipher.encrypt(secretConfig);
        } catch (IntegrationSecretEncryptionException e) {
            LOG.errorf(e, "Failed to encrypt the secret for credential '%s'", context);
            throw e;
        }
    }

    private CredentialProfileResponse toResponse(
            CredentialProfile profile, List<CredentialUsageResponse> usedBy) {
        return new CredentialProfileResponse(
                profile.id(),
                profile.tenantCode(),
                profile.displayName(),
                profile.credentialType(),
                profile.authType(),
                profile.environment(),
                profile.publicConfig(),
                summary(profile),
                profile.secretPreview(),
                profile.secretVersion(),
                profile.lastTestedAt(),
                profile.lastTestResult(),
                usedBy,
                profile.createdAt(),
                profile.updatedAt(),
                profile.createdBy(),
                profile.updatedBy());
    }

    /** The non-secret value that identifies a credential in a list, per type. */
    private static String summary(CredentialProfile profile) {
        if (OAuth2CredentialConfigs.supports(profile.credentialType())) {
            String clientId = OAuth2CredentialConfigs.summary(profile.publicConfig());
            if (clientId != null) {
                return clientId;
            }
        }
        return profile.secretPreview();
    }

    private static Map<String, Object> safeMap(Map<String, Object> map) {
        return map == null ? Map.of() : new LinkedHashMap<>(map);
    }

    private static String maskSecret(Map<String, Object> secretConfig) {
        return secretConfig == null || secretConfig.isEmpty() ? "none" : "****";
    }
}

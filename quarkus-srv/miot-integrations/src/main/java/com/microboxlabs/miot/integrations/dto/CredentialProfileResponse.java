package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * A credential as the API returns it. The encrypted secret is never part of this:
 * {@code secretPreview} is a mask, and {@code summary} is the type's non-secret
 * identifying value (an OAuth client id, say), computed here so a list can identify a
 * credential without every caller knowing the config shape of every type.
 */
public record CredentialProfileResponse(
        String id,
        String tenantCode,
        String displayName,
        CredentialType credentialType,
        AuthType authType,
        String environment,
        Map<String, Object> publicConfig,
        String summary,
        String secretPreview,
        int secretVersion,
        OffsetDateTime lastTestedAt,
        Boolean lastTestResult,
        List<CredentialUsageResponse> usedBy,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String createdBy,
        String updatedBy) {
}

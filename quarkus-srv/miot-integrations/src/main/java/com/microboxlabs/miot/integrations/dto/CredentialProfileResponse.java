package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.AuthType;
import java.time.OffsetDateTime;
import java.util.Map;

public record CredentialProfileResponse(
        String id,
        String tenantCode,
        String displayName,
        AuthType authType,
        Map<String, Object> publicConfig,
        String secretPreview,
        int secretVersion,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}

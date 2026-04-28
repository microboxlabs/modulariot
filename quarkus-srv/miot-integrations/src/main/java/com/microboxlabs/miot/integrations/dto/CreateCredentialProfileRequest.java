package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.AuthType;
import java.util.Map;

public record CreateCredentialProfileRequest(
        String displayName,
        AuthType authType,
        Map<String, Object> publicConfig,
        Map<String, Object> secretConfig) {
}

package com.microboxlabs.miot.integrations.domain;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Map;

public record IntegrationConnection(
        String id,
        String tenantCode,
        String name,
        ProviderType providerType,
        URI baseUrl,
        String credentialProfileId,
        ConnectionStatus status,
        OffsetDateTime lastTestedAt,
        Boolean lastTestResult,
        Map<String, Object> metadata) {
}

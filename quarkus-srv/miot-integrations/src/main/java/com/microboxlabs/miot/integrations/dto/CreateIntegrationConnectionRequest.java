package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.ProviderType;
import java.net.URI;
import java.util.Map;

public record CreateIntegrationConnectionRequest(
        String name,
        ProviderType providerType,
        URI baseUrl,
        String credentialProfileId,
        Map<String, Object> metadata) {
}

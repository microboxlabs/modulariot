package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.ProviderType;
import java.net.URI;
import java.util.Map;

/**
 * Creates a connection. When {@code templateId} is set, the connection is an <em>instance</em>
 * of that template: its {@code providerType} and its operation (method/path/schema) come from
 * the template, and {@code providerType} in this request is ignored. Without a template it is
 * an ad-hoc connection, exactly as before.
 */
public record CreateIntegrationConnectionRequest(
        String name,
        ProviderType providerType,
        URI baseUrl,
        String credentialProfileId,
        Map<String, Object> metadata,
        String templateId) {
}

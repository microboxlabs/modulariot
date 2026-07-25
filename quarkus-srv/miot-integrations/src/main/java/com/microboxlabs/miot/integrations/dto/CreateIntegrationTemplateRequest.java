package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.ProviderType;
import java.util.Map;

/**
 * Defines an integration type: the contract every connection created from it will share.
 * {@code operationName}/{@code method}/{@code path}/{@code requestSchema} are copied onto
 * each instance's operation; {@code providerType} is the kind those instances take.
 */
public record CreateIntegrationTemplateRequest(
        String name,
        ProviderType providerType,
        String operationName,
        String method,
        String path,
        Map<String, Object> requestSchema,
        Map<String, Object> responseSchema) {
}

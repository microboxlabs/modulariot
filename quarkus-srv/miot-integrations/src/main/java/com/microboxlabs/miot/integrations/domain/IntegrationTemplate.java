package com.microboxlabs.miot.integrations.domain;

import java.util.Map;

/**
 * An operator-defined integration type: the reusable contract a family of connections
 * shares. Like an n8n node type, it owns the payload shape — the operation to call
 * ({@code operationName}, {@code method}, {@code path}) and its {@code requestSchema} /
 * {@code responseSchema} — while each connection instance supplies its own base URL and
 * credential.
 */
public record IntegrationTemplate(
        String id,
        String tenantCode,
        String name,
        ProviderType providerType,
        String operationName,
        String method,
        String path,
        Map<String, Object> requestSchema,
        Map<String, Object> responseSchema) {
}

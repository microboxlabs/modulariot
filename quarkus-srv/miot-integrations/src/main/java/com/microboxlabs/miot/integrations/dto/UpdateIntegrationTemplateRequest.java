package com.microboxlabs.miot.integrations.dto;

import java.util.Map;

/**
 * Partial update for an integration template. Every field is optional — a {@code null}
 * field leaves the stored value unchanged. {@code providerType} is intentionally absent:
 * a template's kind is fixed once instances exist against it.
 *
 * <p>Edits apply to connections created <em>after</em> the change; existing instances keep
 * the contract they were provisioned with (their operation is a copy). Retro-propagation to
 * live instances is a separate, opt-in operation.
 */
public record UpdateIntegrationTemplateRequest(
        String name,
        String operationName,
        String method,
        String path,
        Map<String, Object> requestSchema,
        Map<String, Object> responseSchema) {
}

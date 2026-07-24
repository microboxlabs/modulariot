package com.microboxlabs.miot.integrations.dto;

import java.util.Map;

/**
 * Create-or-replace a binding. Addressed by its natural key
 * ({@code eventType} + scope + {@code connectionId}) rather than an id, because that is
 * what the settings drawer knows when the operator presses Save.
 *
 * <p>The owning org and tenant come from the request context, never the body — a caller
 * must not be able to author a binding on another org's behalf.
 */
public record UpsertIntegrationEventBindingRequest(
        String eventType,
        /** Null means the binding applies to every scope of this event type. */
        String scopeKind,
        String scopeKey,
        String connectionId,
        /** Required for operation-based channels (generic HTTP); unused by others. */
        String operationId,
        Map<String, Object> matchCondition,
        /** fieldId → template. */
        Map<String, String> fieldTemplates,
        Boolean enabled) {

    public boolean isEnabled() {
        return Boolean.TRUE.equals(enabled);
    }
}

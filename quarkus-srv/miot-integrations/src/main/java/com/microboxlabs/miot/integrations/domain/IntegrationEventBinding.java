package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Binds an event in some scope to a channel: when {@code eventType} happens in
 * {@code scopeKind}/{@code scopeKey}, if {@code matchCondition} holds, send it to
 * {@code connectionId} (optionally a specific {@code operationId}), shaped by
 * {@code fieldTemplates}.
 *
 * <p>Nothing here is review- or kanban-specific. {@code scopeKind}/{@code scopeKey} are
 * <b>opaque</b> to this module — it stores and matches them but never parses them, so the
 * producer of an event owns what a scope means and no caller's vocabulary leaks into the
 * schema.
 *
 * <p>{@code tenantClientId} is the Auth0 M2M client; because several orgs can share one,
 * {@code ownerOrgSlug} records which org actually authored the binding.
 */
public record IntegrationEventBinding(
        String id,
        String tenantClientId,
        String ownerOrgSlug,
        String eventType,
        String scopeKind,
        String scopeKey,
        String connectionId,
        String operationId,
        Map<String, Object> matchCondition,
        Map<String, String> fieldTemplates,
        boolean enabled,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String createdBy,
        String updatedBy) {

    /** Whether this binding applies to every scope of its event type. */
    public boolean appliesToEveryScope() {
        return scopeKind == null || scopeKind.isBlank();
    }
}

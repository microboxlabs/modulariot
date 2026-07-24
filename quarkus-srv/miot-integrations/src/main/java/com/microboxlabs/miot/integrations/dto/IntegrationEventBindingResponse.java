package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * A binding as the settings UI sees it. {@code inherited} tells the caller this binding
 * came from a parent org: it is visible and it fires, but this org may not edit it.
 */
public record IntegrationEventBindingResponse(
        String id,
        String ownerOrgSlug,
        boolean inherited,
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
        String updatedBy) {

    public static IntegrationEventBindingResponse of(
            IntegrationEventBinding binding, String callerOrgSlug) {
        return new IntegrationEventBindingResponse(
                binding.id(),
                binding.ownerOrgSlug(),
                !binding.ownerOrgSlug().equals(callerOrgSlug),
                binding.eventType(),
                binding.scopeKind(),
                binding.scopeKey(),
                binding.connectionId(),
                binding.operationId(),
                binding.matchCondition(),
                binding.fieldTemplates(),
                binding.enabled(),
                binding.createdAt(),
                binding.updatedAt(),
                binding.updatedBy());
    }
}

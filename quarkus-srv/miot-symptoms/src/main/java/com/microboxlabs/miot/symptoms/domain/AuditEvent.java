package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/** Append-only record of one write through the Control Tower API. */
public record AuditEvent(
        String id,
        String tenantCode,
        String actor,
        String action,
        String entityType,
        String entityId,
        Long symptomId,
        Map<String, Object> details,
        OffsetDateTime createdAt) {
}

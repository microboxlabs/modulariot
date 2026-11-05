package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/** One appended audit row; {@code action} reads {@code <entity>.<past_tense_verb>}. */
public record AuditEvent(
        Long id,
        String tenantCode,
        String actor,
        String action,
        String entityType,
        String entityId,
        String tripId,
        Map<String, Object> details,
        OffsetDateTime createdAt) {
}

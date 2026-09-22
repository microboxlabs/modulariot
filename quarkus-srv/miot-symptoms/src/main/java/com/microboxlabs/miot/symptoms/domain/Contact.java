package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;
import java.util.List;

/** Someone the tower can call about a symptom: a named person with a role and the channels they answer on. */
public record Contact(
        String id,
        String tenantCode,
        String name,
        String role,
        String phone,
        List<CallMethod> methods,
        boolean active,
        String notes,
        String createdBy,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}

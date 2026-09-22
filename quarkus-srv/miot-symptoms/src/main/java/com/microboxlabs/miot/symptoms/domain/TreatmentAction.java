package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** One step inside a {@link Treatment}, in the order it happened ({@code seq}). */
public record TreatmentAction(
        String id,
        String treatmentId,
        String tenantCode,
        int seq,
        ActionKind kind,
        String contactId,
        String contactName,
        String contactRole,
        String contactPhone,
        CallMethod method,
        String outcomeKey,
        String outcomeLabel,
        Boolean answered,
        Integer durationSeconds,
        String note,
        List<String> tags,
        Map<String, Object> details,
        String performedBy,
        OffsetDateTime performedAt) {
}

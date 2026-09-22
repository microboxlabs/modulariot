package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * One step inside a {@link Treatment}, in order ({@code seq}). For a call,
 * {@code message} is what the operator told the contact and {@code note} what
 * came back; the contact fields are copied at the time of the call.
 */
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
        String message,
        String note,
        List<String> tags,
        Map<String, Object> details,
        String performedBy,
        OffsetDateTime performedAt) {
}

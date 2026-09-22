package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;

/** A treatment episode: what one operator did about one symptom, from opening a form to finishing it. */
public record Treatment(
        String id,
        String tenantCode,
        long symptomId,
        String assetId,
        String tripId,
        TreatmentType type,
        TreatmentStatus status,
        String openedBy,
        OffsetDateTime openedAt,
        String closedBy,
        OffsetDateTime closedAt,
        String resolution,
        String note,
        OffsetDateTime updatedAt) {
}

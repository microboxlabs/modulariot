package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;

/**
 * A treatment episode: everything one operator did about one symptom between
 * opening a form and finishing it. {@code legacyTreatmentId} is the row the
 * episode mirrors into StreamHub {@code public.treatments} so the engine and
 * the existing tower views keep seeing "under treatment".
 */
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
        Long legacyTreatmentId,
        String idempotencyKey,
        OffsetDateTime updatedAt) {
}

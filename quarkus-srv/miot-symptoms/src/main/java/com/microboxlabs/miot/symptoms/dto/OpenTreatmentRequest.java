package com.microboxlabs.miot.symptoms.dto;

import com.microboxlabs.miot.symptoms.domain.TreatmentType;

/**
 * Body to open a treatment on a symptom. {@code idempotencyKey} lets a client
 * retry the open safely: the same key on the same tenant returns the episode
 * that was already created. Tenant and actor are never taken from the body.
 */
public record OpenTreatmentRequest(
        TreatmentType type,
        String assetId,
        String tripId,
        String note,
        String idempotencyKey) {
}

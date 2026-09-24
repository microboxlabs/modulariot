package com.microboxlabs.miot.symptoms.dto;

import com.microboxlabs.miot.symptoms.domain.TreatmentType;

/** Body to open a treatment on a symptom. Tenant and actor are never taken from the body. */
public record OpenTreatmentRequest(
        TreatmentType type,
        String assetId,
        String tripId,
        String note) {
}

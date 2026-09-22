package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/** A row of StreamHub {@code public.treatments} linked to a symptom, as the older tower wrote it. */
public record LegacyTreatment(
        long id,
        String treatmentType,
        String status,
        String assignedTo,
        Map<String, Object> description,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        Integer symptomTreatmentTime) {
}

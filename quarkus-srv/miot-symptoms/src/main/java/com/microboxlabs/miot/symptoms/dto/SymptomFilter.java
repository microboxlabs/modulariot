package com.microboxlabs.miot.symptoms.dto;

import java.time.OffsetDateTime;

/** Filters for the symptom list. All fields optional; dates bound {@code first_signal_timestamp}. */
public record SymptomFilter(
        Integer icuCode,
        String assetId,
        String tripId,
        String symptomName,
        Boolean active,
        OffsetDateTime from,
        OffsetDateTime to) {
}

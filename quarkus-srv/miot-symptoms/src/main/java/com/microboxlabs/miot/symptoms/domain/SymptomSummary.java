package com.microboxlabs.miot.symptoms.domain;

import java.time.OffsetDateTime;

/** One row of StreamHub {@code public.symptoms}, joined with its live trip and open-treatment count. */
public record SymptomSummary(
        long id,
        String assetId,
        String tripId,
        String symptomName,
        String symptomType,
        Integer icuCode,
        String icuCondition,
        OffsetDateTime firstSignalAt,
        OffsetDateTime lastSignalAt,
        OffsetDateTime finishedAt,
        boolean active,
        boolean withTrip,
        Double accumulatedValue,
        Integer accumulatedSignals,
        String driverName,
        String tripType,
        long openTreatmentCount,
        String lastAssignedTo) {
}

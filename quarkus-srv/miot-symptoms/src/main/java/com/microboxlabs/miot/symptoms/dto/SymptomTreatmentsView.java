package com.microboxlabs.miot.symptoms.dto;

import com.microboxlabs.miot.symptoms.domain.LegacyTreatment;
import java.util.List;

/**
 * Everything the tower did about one symptom: episodes recorded through this
 * API plus rows the older tower wrote straight into StreamHub. A legacy row
 * that an episode mirrors appears in both lists, linked by
 * {@code legacyTreatmentId}.
 */
public record SymptomTreatmentsView(
        long symptomId,
        List<TreatmentView> treatments,
        List<LegacyTreatment> legacy) {
}

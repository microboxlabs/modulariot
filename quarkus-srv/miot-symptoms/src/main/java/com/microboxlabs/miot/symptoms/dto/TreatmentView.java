package com.microboxlabs.miot.symptoms.dto;

import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import java.time.OffsetDateTime;
import java.util.List;

/** A treatment with its actions in order. */
public record TreatmentView(
        String id,
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
        OffsetDateTime updatedAt,
        List<TreatmentAction> actions) {

    public static TreatmentView of(Treatment t, List<TreatmentAction> actions) {
        return new TreatmentView(
                t.id(), t.symptomId(), t.assetId(), t.tripId(), t.type(), t.status(),
                t.openedBy(), t.openedAt(), t.closedBy(), t.closedAt(), t.resolution(), t.note(),
                t.updatedAt(), actions);
    }
}

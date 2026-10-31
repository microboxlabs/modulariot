package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.OptionalLong;
import java.util.UUID;

/**
 * A case the symptom evaluator opened: its ACTIVE OPENED transition. In the Control Tower its symptom id is
 * {@link #symptomId()}, the transition id negated, so it never meets a GPS database symptom id.
 *
 * @param closedAt    when an operator closed it, or null while open
 * @param treatments  its open treatments
 * @param slaMinutes  the time an operator has to take it at its level, or null when the level has none
 * @param recurrence  the earlier cases of the same symptom on its trip, or null without a trip
 */
public record EngineCase(long id, UUID definitionId, String version, String name, String family, String assetId,
        Instant openedAt, int level, String tripId, Double latitude, Double longitude, Double speedKmh,
        Instant closedAt, long treatments, Integer slaMinutes, Long recurrence) {

    public long symptomId() {
        return -id;
    }

    /** The case id behind a Control Tower symptom id, or empty for a GPS database symptom. */
    public static OptionalLong caseId(long symptomId) {
        return symptomId < 0 ? OptionalLong.of(-symptomId) : OptionalLong.empty();
    }
}

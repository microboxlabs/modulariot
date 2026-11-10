package com.microboxlabs.miot.symptoms.evaluator;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.lostsignal.TripEnds;
import java.time.Instant;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.UUID;

/**
 * A change to a case: it opened, its level rose, or it closed. {@code state}
 * is the version's: TEST transitions are recorded in shadow only, ACTIVE ones
 * create cases and send notices. {@code HELD} is an opening a hold kept back
 * ({@link Holds}): it is recorded as evidence, opens no case and sends nothing.
 * {@code NOTED} is a timeline entry the symptom's note rule wrote on an open
 * case ({@code lifecycle.note}); the case does not change and nothing is sent.
 *
 * A CLOSED row's measure is the case's maximum ({@link Episode#maxMeasure()}), while its context is the
 * closing frame (the last frame on its trip when duty counters have reset after trip end).
 *
 * @param previousLevel the level before this change; 0 when the case opens
 * @param detail        what the log keeps with the change instead of the signal's context, or null: for
 *                      {@code NOTED}, {@code {"note": {"event_type", "description", "at"}}}
 * @param tripId        the case's trip, recorded instead of the signal's; null to record the signal's
 * @param operator      on {@code OPENED} and {@code LEVEL_CHANGED}: whether the case at this level goes to the
 *                      operators, decided on this signal from the level's {@code operator} and
 *                      {@code operatorWhen}. Null when not decided; the case store then reads the spec
 */
public record Transition(
        Kind kind,
        UUID definitionId,
        String version,
        SymptomState state,
        String assetId,
        Instant at,
        int level,
        int previousLevel,
        double measure,
        Map<String, Object> detail,
        String tripId,
        Boolean operator) {

    @SuppressWarnings("java:S107")
    public Transition(Kind kind, UUID definitionId, String version, SymptomState state, String assetId, Instant at,
            int level, int previousLevel, double measure, Map<String, Object> detail, String tripId) {
        this(kind, definitionId, version, state, assetId, at, level, previousLevel, measure, detail, tripId, null);
    }

    public Transition(Kind kind, UUID definitionId, String version, SymptomState state, String assetId, Instant at,
            int level, int previousLevel, double measure) {
        this(kind, definitionId, version, state, assetId, at, level, previousLevel, measure, null);
    }

    @SuppressWarnings("java:S107")
    public Transition(Kind kind, UUID definitionId, String version, SymptomState state, String assetId, Instant at,
            int level, int previousLevel, double measure, Map<String, Object> detail) {
        this(kind, definitionId, version, state, assetId, at, level, previousLevel, measure, detail, null);
    }

    public Transition withDetail(Map<String, Object> value) {
        return new Transition(kind, definitionId, version, state, assetId, at, level, previousLevel, measure, value,
                tripId, operator);
    }

    public Transition withTrip(String value) {
        return new Transition(kind, definitionId, version, state, assetId, at, level, previousLevel, measure, detail,
                value, operator);
    }

    public Transition withOperator(Boolean value) {
        return new Transition(kind, definitionId, version, state, assetId, at, level, previousLevel, measure, detail,
                tripId, value);
    }

    /** Records a close on its case's trip, retaining explicit state-change reasons. */
    public Transition closingOn(String caseTrip, String activeTrip, Map<String, Object> context) {
        Transition closed = withTrip(caseTrip);
        if (caseTrip == null || caseTrip.equals(activeTrip) || (detail != null && detail.containsKey("reason"))) {
            return closed;
        }
        Map<String, Object> base = detail == null ? context : detail;
        Map<String, Object> kept = base == null ? new LinkedHashMap<>()
                : new LinkedHashMap<>(base);
        kept.put("reason", TripEnds.REASON);
        return closed.withDetail(kept);
    }

    /** Why a case closed when its symptom changed state, kept in the CLOSED row's context. */
    public static final String STATE_CHANGE_REASON = "cambio de estado del síntoma";

    public enum Kind {
        OPENED,
        LEVEL_CHANGED,
        CLOSED,
        HELD,
        NOTED
    }
}

package com.microboxlabs.miot.symptoms.evaluator;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * How an operator closed a case: invalidated, or handled (call, note, ignore), and the case's level then. Until the
 * condition goes normal, the same symptom on the same vehicle and trip opens a new case only above
 * {@link #reopenAbove()}.
 *
 * @param tripId the case's trip, or null
 * @param at     when the operator closed it
 */
public record OperatorClose(String tripId, Instant at, int level, boolean invalidated) {

    /** The key of the CLOSED row's context that records the operator's close. */
    public static final String CONTEXT_KEY = "operator_close";
    static final String INVALIDATED = "INVALIDATED";
    static final String HANDLED = "HANDLED";

    /** An invalidated case blocks every level; a handled one blocks up to its level. */
    public int reopenAbove() {
        return invalidated ? Integer.MAX_VALUE : level;
    }

    /** The CLOSED row's context. */
    public Map<String, Object> context() {
        Map<String, Object> close = new LinkedHashMap<>();
        close.put("outcome", invalidated ? INVALIDATED : HANDLED);
        close.put("level", level);
        return Map.of(CONTEXT_KEY, close);
    }

    /** The operator's close a CLOSED row's context records; empty for a close by the engine. */
    public static Optional<OperatorClose> fromContext(String tripId, Instant at, Map<String, Object> context) {
        if (context == null || !(context.get(CONTEXT_KEY) instanceof Map<?, ?> close)
                || !(close.get("level") instanceof Number level)) {
            return Optional.empty();
        }
        return Optional.of(new OperatorClose(tripId, at, level.intValue(), INVALIDATED.equals(close.get("outcome"))));
    }

    /** The episode marker this close leaves, or null without a trip. */
    public Episode marker(java.util.UUID definitionId, String assetId) {
        return tripId == null ? null : Episode.closedOnTrip(definitionId, assetId, tripId, at, reopenAbove());
    }
}

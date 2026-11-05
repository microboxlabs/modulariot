package com.microboxlabs.miot.symptoms.evaluator;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * A change to a case: it opened, its level rose, or it closed. {@code state}
 * is the version's: TEST transitions are recorded in shadow only, ACTIVE ones
 * create cases and send notices. {@code HELD} is an opening a hold kept back
 * ({@link Holds}): it is recorded as evidence, opens no case and sends nothing.
 * {@code NOTED} is a timeline entry the symptom's note rule wrote on an open
 * case ({@code lifecycle.note}); the case does not change and nothing is sent.
 *
 * @param previousLevel the level before this change; 0 when the case opens
 * @param detail        what the log keeps with the change instead of the signal's context, or null: for
 *                      {@code NOTED}, {@code {"note": {"event_type", "description", "at"}}}
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
        Map<String, Object> detail) {

    public Transition(Kind kind, UUID definitionId, String version, SymptomState state, String assetId, Instant at,
            int level, int previousLevel, double measure) {
        this(kind, definitionId, version, state, assetId, at, level, previousLevel, measure, null);
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

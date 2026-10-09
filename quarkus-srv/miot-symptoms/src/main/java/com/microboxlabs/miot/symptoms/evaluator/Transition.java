package com.microboxlabs.miot.symptoms.evaluator;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import java.time.Instant;
import java.util.UUID;

/**
 * A change to a case: it opened, its level rose, or it closed. {@code state}
 * is the version's: TEST transitions are recorded in shadow only, ACTIVE ones
 * create cases and send notices.
 *
 * @param previousLevel the level before this change; 0 when the case opens
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
        double measure) {

    public enum Kind {
        OPENED,
        LEVEL_CHANGED,
        CLOSED
    }
}

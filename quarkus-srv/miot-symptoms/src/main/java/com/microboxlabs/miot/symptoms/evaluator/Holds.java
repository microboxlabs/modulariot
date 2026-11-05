package com.microboxlabs.miot.symptoms.evaluator;

import java.time.Instant;
import java.util.UUID;

/**
 * The "Ignorar condición" holds the evaluator reads before it opens or raises a case. A held symptom keeps being
 * evaluated, but its open case stays at its level and a new case does not open.
 */
@FunctionalInterface
public interface Holds {

    /** Nothing is held. */
    Holds NONE = (tenantCode, assetId, definitionId, caseOpenedAt) -> false;

    /**
     * Whether a hold covers the symptom on the vehicle now.
     *
     * @param caseOpenedAt when the symptom's open case opened, or null when it has none
     */
    boolean held(String tenantCode, String assetId, UUID definitionId, Instant caseOpenedAt);
}

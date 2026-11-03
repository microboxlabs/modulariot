package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

/**
 * An "Ignorar condición" hold: an OPEN treatment on an engine case with an {@code IGNORE} action. It runs from the
 * action's time for {@code durationSeconds}, or until the case's trip ends.
 *
 * @param caseId     the case the operator ignored (its OPENED transition id)
 * @param caseClosed whether that case has closed since
 */
public record IgnoreHold(String id, String tenantCode, long caseId, String assetId, UUID definitionId,
        String tripId, Scope scope, Instant at, String by, Integer durationSeconds, boolean untilTripEnd,
        boolean caseClosed) {

    /** What the hold silences on the vehicle. */
    public enum Scope {
        /** The ignored case only. */
        CASE,
        /** Every case of the same symptom, open or new. */
        SYMPTOM,
        /** Every case of any symptom, open or new. */
        ALL;

        /** CASE when absent. */
        public static Scope parse(Object value) {
            if (value == null || value.toString().isBlank()) {
                return CASE;
            }
            try {
                return valueOf(value.toString().trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("scope must be CASE, SYMPTOM or ALL");
            }
        }
    }

    /** When the hold ends by time, or null when it lasts until the trip ends. */
    public Instant until() {
        return untilTripEnd || durationSeconds == null ? null : at.plusSeconds(durationSeconds);
    }

    public boolean activeAt(Instant now) {
        Instant until = until();
        return untilTripEnd || (until != null && until.isAfter(now));
    }

    /**
     * Whether it covers the symptom on its vehicle: the ignored case itself (open since before the hold), the same
     * symptom, or any symptom, by scope.
     *
     * @param caseOpenedAt when the symptom's open case opened, or null when none is open
     */
    public boolean covers(String asset, UUID definition, Instant caseOpenedAt) {
        if (!assetId.equals(asset)) {
            return false;
        }
        return switch (scope) {
            case ALL -> true;
            case SYMPTOM -> definitionId.equals(definition);
            case CASE -> definitionId.equals(definition) && caseOpenedAt != null && !caseOpenedAt.isAfter(at);
        };
    }
}

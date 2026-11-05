package com.microboxlabs.miot.symptoms.evaluator;

import io.quarkus.runtime.annotations.RegisterForReflection;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * What the evaluator remembers between signals for one vehicle and one
 * symptom: the current runs of the activation and of the condition, since when
 * each level's threshold holds, and the open case if there is one.
 *
 * @param candidateSince first signal of the current run where the activation held, or null
 * @param conditionSince first signal of the current run that reached a level, or null
 * @param normalSince    first signal since the condition stopped holding, or null
 * @param levelSince     per ICU level, the first signal of the current run whose measure met that level's
 *                       threshold, for levels qualified by a hold time; reset when the version changes
 * @param lastSignalAt   the newest signal applied
 * @param openedAt       when the case opened, or null when no case is open
 * @param level          the case's level; with no case open, 0, or the level of an opening a hold keeps back
 * @param maxMeasure     the highest measure since the case opened
 */
@RegisterForReflection
public record Episode(
        UUID definitionId,
        String version,
        String assetId,
        Instant candidateSince,
        Instant conditionSince,
        Instant normalSince,
        Map<Integer, Instant> levelSince,
        Instant lastSignalAt,
        Instant openedAt,
        int level,
        double maxMeasure,
        String closedOnTrip,
        Instant closedOnTripAt) {

    public Episode {
        levelSince = levelSince == null ? Map.of() : Map.copyOf(levelSince);
    }

    public Episode(UUID definitionId, String version, String assetId, Instant candidateSince, Instant conditionSince,
            Instant normalSince, Map<Integer, Instant> levelSince, Instant lastSignalAt, Instant openedAt, int level,
            double maxMeasure) {
        this(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince, lastSignalAt,
                openedAt, level, maxMeasure, null, null);
    }

    /** Nothing running, but an operator closed the symptom's case on this trip at {@code at}. */
    public static Episode closedOnTrip(UUID definitionId, String assetId, String tripId, Instant at) {
        return new Episode(definitionId, "", assetId, null, null, null, Map.of(), null, null, 0, 0, tripId, at);
    }

    public static Episode start(UUID definitionId, String version, String assetId) {
        return new Episode(definitionId, version, assetId, null, null, null, Map.of(), null, null, 0, 0);
    }

    public boolean open() {
        return openedAt != null;
    }

    /**
     * Whether there is anything worth keeping: a run of the activation, a level waiting, an open case, or the trip
     * an operator closed a case on.
     */
    public boolean worthKeeping() {
        return candidateSince != null || conditionSince != null || !levelSince.isEmpty() || open()
                || closedOnTrip != null;
    }

    static double seconds(Instant from, Instant to) {
        return from == null ? 0 : Math.max(0, Duration.between(from, to).toMillis() / 1000.0);
    }
}

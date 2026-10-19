package com.microboxlabs.miot.symptoms.evaluator;

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
 * @param level          the case's level; 0 when no case is open
 * @param maxMeasure     the highest measure since the case opened
 */
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
        double maxMeasure) {

    public Episode {
        levelSince = levelSince == null ? Map.of() : Map.copyOf(levelSince);
    }

    public static Episode start(UUID definitionId, String version, String assetId) {
        return new Episode(definitionId, version, assetId, null, null, null, Map.of(), null, null, 0, 0);
    }

    public boolean open() {
        return openedAt != null;
    }

    /** Whether there is anything worth keeping: a run of the activation, a level waiting, or an open case. */
    public boolean worthKeeping() {
        return candidateSince != null || conditionSince != null || !levelSince.isEmpty() || open();
    }

    static double seconds(Instant from, Instant to) {
        return from == null ? 0 : Math.max(0, Duration.between(from, to).toMillis() / 1000.0);
    }
}

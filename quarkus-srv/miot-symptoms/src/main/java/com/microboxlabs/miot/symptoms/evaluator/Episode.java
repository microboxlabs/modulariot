package com.microboxlabs.miot.symptoms.evaluator;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
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
 * @param state          the state of the open case, or null before it was recorded or with no case open
 * @param offTripSince   first observed off-trip signal while the case is open, reset by an active trip
 * @param tripEnded      the latest applied frame is outside the case's trip; separate from rule off-trip timers
 * @param lastContext    the latest context on the case's trip; null before legacy metadata is recovered
 * @param tripId         the trip the case opened on, or null; legacy episodes recover it from the opening row
 * @param reopenAbove    after an operator closed a case on {@code closedOnTrip}, the level a new case must exceed
 *                       until the condition goes normal; null when nothing is blocked
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
        SymptomState state,
        String closedOnTrip,
        Instant closedOnTripAt,
        Instant offTripSince,
        String tripId,
        Map<String, Object> lastContext,
        boolean tripEnded,
        @JsonInclude(JsonInclude.Include.NON_NULL) Integer reopenAbove) {

    public Episode {
        levelSince = levelSince == null ? Map.of() : Map.copyOf(levelSince);
    }

    @SuppressWarnings("java:S107")
    public Episode(UUID definitionId, String version, String assetId, Instant candidateSince, Instant conditionSince,
            Instant normalSince, Map<Integer, Instant> levelSince, Instant lastSignalAt, Instant openedAt, int level,
            double maxMeasure, SymptomState state, String closedOnTrip, Instant closedOnTripAt,
            Instant offTripSince, String tripId, Map<String, Object> lastContext, boolean tripEnded) {
        this(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince, lastSignalAt,
                openedAt, level, maxMeasure, state, closedOnTrip, closedOnTripAt, offTripSince, tripId, lastContext,
                tripEnded, null);
    }

    @SuppressWarnings("java:S107")
    public Episode(UUID definitionId, String version, String assetId, Instant candidateSince, Instant conditionSince,
            Instant normalSince, Map<Integer, Instant> levelSince, Instant lastSignalAt, Instant openedAt, int level,
            double maxMeasure, SymptomState state, String closedOnTrip, Instant closedOnTripAt,
            Instant offTripSince, String tripId, Map<String, Object> lastContext) {
        this(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince, lastSignalAt,
                openedAt, level, maxMeasure, state, closedOnTrip, closedOnTripAt, offTripSince, tripId, lastContext,
                false);
    }

    @SuppressWarnings("java:S107")
    public Episode(UUID definitionId, String version, String assetId, Instant candidateSince, Instant conditionSince,
            Instant normalSince, Map<Integer, Instant> levelSince, Instant lastSignalAt, Instant openedAt, int level,
            double maxMeasure, SymptomState state, String closedOnTrip, Instant closedOnTripAt,
            Instant offTripSince, String tripId) {
        this(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince, lastSignalAt,
                openedAt, level, maxMeasure, state, closedOnTrip, closedOnTripAt, offTripSince, tripId, null);
    }

    /** Keeps the case's identity and last context without changing rule evidence or timers. */
    public Episode withCaseFrame(String trip, Map<String, Object> context) {
        return new Episode(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince,
                lastSignalAt, openedAt, level, maxMeasure, state, closedOnTrip, closedOnTripAt, offTripSince, trip,
                context == null ? Map.of() : Map.copyOf(context), tripEnded, reopenAbove);
    }

    @SuppressWarnings("java:S107")
    public Episode(UUID definitionId, String version, String assetId, Instant candidateSince, Instant conditionSince,
            Instant normalSince, Map<Integer, Instant> levelSince, Instant lastSignalAt, Instant openedAt, int level,
            double maxMeasure, SymptomState state, String closedOnTrip, Instant closedOnTripAt,
            Instant offTripSince) {
        this(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince, lastSignalAt,
                openedAt, level, maxMeasure, state, closedOnTrip, closedOnTripAt, offTripSince, null);
    }

    @SuppressWarnings("java:S107")
    public Episode(UUID definitionId, String version, String assetId, Instant candidateSince, Instant conditionSince,
            Instant normalSince, Map<Integer, Instant> levelSince, Instant lastSignalAt, Instant openedAt, int level,
            double maxMeasure) {
        this(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince, lastSignalAt,
                openedAt, level, maxMeasure, null, null, null, null);
    }

    @SuppressWarnings("java:S107")
    public Episode(UUID definitionId, String version, String assetId, Instant candidateSince, Instant conditionSince,
            Instant normalSince, Map<Integer, Instant> levelSince, Instant lastSignalAt, Instant openedAt, int level,
            double maxMeasure, Instant offTripSince) {
        this(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince, lastSignalAt,
                openedAt, level, maxMeasure, null, null, null, offTripSince);
    }

    @SuppressWarnings("java:S107")
    public Episode(UUID definitionId, String version, String assetId, Instant candidateSince, Instant conditionSince,
            Instant normalSince, Map<Integer, Instant> levelSince, Instant lastSignalAt, Instant openedAt, int level,
            double maxMeasure, String closedOnTrip, Instant closedOnTripAt) {
        this(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince, lastSignalAt,
                openedAt, level, maxMeasure, null, closedOnTrip, closedOnTripAt, null);
    }

    /** An episode with its case state, before off-trip evidence is available. */
    @SuppressWarnings("java:S107")
    public Episode(UUID definitionId, String version, String assetId, Instant candidateSince, Instant conditionSince,
            Instant normalSince, Map<Integer, Instant> levelSince, Instant lastSignalAt, Instant openedAt, int level,
            double maxMeasure, SymptomState state) {
        this(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince, lastSignalAt,
                openedAt, level, maxMeasure, state, null, null, null);
    }

    @SuppressWarnings("java:S107")
    public Episode(UUID definitionId, String version, String assetId, Instant candidateSince, Instant conditionSince,
            Instant normalSince, Map<Integer, Instant> levelSince, Instant lastSignalAt, Instant openedAt, int level,
            double maxMeasure, SymptomState state, Instant offTripSince) {
        this(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince, lastSignalAt,
                openedAt, level, maxMeasure, state, null, null, offTripSince);
    }

    @SuppressWarnings("java:S107")
    public Episode(UUID definitionId, String version, String assetId, Instant candidateSince, Instant conditionSince,
            Instant normalSince, Map<Integer, Instant> levelSince, Instant lastSignalAt, Instant openedAt, int level,
            double maxMeasure, String closedOnTrip, Instant closedOnTripAt, Instant offTripSince) {
        this(definitionId, version, assetId, candidateSince, conditionSince, normalSince, levelSince, lastSignalAt,
                openedAt, level, maxMeasure, null, closedOnTrip, closedOnTripAt, offTripSince);
    }

    /** A marker written before its close timestamp was recorded. */
    public static Episode closedOnTrip(UUID definitionId, String assetId, String tripId) {
        return closedOnTrip(definitionId, assetId, tripId, null);
    }

    /** Nothing running, but an operator closed the symptom's case on this trip at {@code at}. */
    public static Episode closedOnTrip(UUID definitionId, String assetId, String tripId, Instant at) {
        return closedOnTrip(definitionId, assetId, tripId, at, null);
    }

    /**
     * As {@link #closedOnTrip(UUID, String, String, Instant)}, and while the condition holds a new case opens only
     * above {@code reopenAbove}; null blocks nothing.
     */
    public static Episode closedOnTrip(UUID definitionId, String assetId, String tripId, Instant at,
            Integer reopenAbove) {
        return new Episode(definitionId, "", assetId, null, null, null, Map.of(), null, null, 0, 0, null, tripId, at,
                null, null, null, false, reopenAbove);
    }

    /** Keep the condition's timers when an operator closes its case; closing is not a new run. */
    Episode continuingCondition(Episode previous) {
        if (previous == null || closedOnTrip == null
                || !(closedOnTrip.equals(previous.tripId()) || closedOnTrip.equals(previous.closedOnTrip()))) {
            return this;
        }
        boolean normal = previous.normalSince() != null && previous.levelSince().isEmpty();
        return new Episode(definitionId, previous.version(), assetId, previous.candidateSince(),
                previous.conditionSince(), previous.normalSince(), previous.levelSince(), previous.lastSignalAt(),
                null, 0, 0, null, closedOnTrip, closedOnTripAt, null, null, null, false,
                normal ? null : reopenAbove);
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

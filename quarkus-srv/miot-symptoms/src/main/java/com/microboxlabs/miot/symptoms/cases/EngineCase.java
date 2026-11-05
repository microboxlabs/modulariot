package com.microboxlabs.miot.symptoms.cases;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
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
 * @param tripCode    the client's service code from the live trip's first mandate, or null when unavailable
 * @param openingContext what the rules read when the case opened, preserving the start of its silence
 * @param levelContext what the rules read when the case reached its level, or null when it was not kept
 * @param levelRule   the rule of its level in the version that opened it, or null when unknown
 * @param levels      the case's level from each of its changes, oldest first; empty when not read
 * @param trip        the live trip's driver, carrier, origin and destination names, or null without a live trip
 * @param closingContext what the rules read on the transition that closed it, or null (open, closed by an
 *                    operator, or not read)
 * @param ignored     the "Ignorar condición" hold that covers it now, or null
 * @param returnedAt  when the latest hold that covered it ended, if that was after it opened; it came back to the
 *                    tower then
 */
public record EngineCase(long id, UUID definitionId, String version, String name, String family, String assetId,
        Instant openedAt, int level, String tripId, Double latitude, Double longitude, Double speedKmh,
        Instant closedAt, long treatments, Integer slaMinutes, Long recurrence, String tripCode,
        JsonNode openingContext, JsonNode levelContext, String levelRule, List<LevelStep> levels,
        TripDetails trip, JsonNode closingContext, Ignored ignored, Instant returnedAt) {

    /**
     * A hold on the case: since when, until when (null until the trip ends), what it covers and who set it.
     *
     * @param treatmentId the hold's treatment
     */
    public record Ignored(String treatmentId, Instant since, Instant until, boolean untilTripEnd, String scope,
            String by) {
    }

    /** Names from the case's live trip; each null when the trip does not have it. */
    public record TripDetails(String driver, String carrier, String origin, String destination) {
    }

    /** The case reached {@code level} at {@code at}. */
    public record LevelStep(Instant at, int level) {
    }

    public EngineCase {
        levels = levels == null ? List.of() : List.copyOf(levels);
    }

    @SuppressWarnings("java:S107")
    public EngineCase(long id, UUID definitionId, String version, String name, String family, String assetId,
            Instant openedAt, int level, String tripId, Double latitude, Double longitude, Double speedKmh,
            Instant closedAt, long treatments, Integer slaMinutes, Long recurrence, String tripCode,
            JsonNode openingContext, JsonNode levelContext, String levelRule, List<LevelStep> levels) {
        this(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude, longitude,
                speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, openingContext, levelContext,
                levelRule, levels, null, null, null, null);
    }

    @SuppressWarnings("java:S107")
    public EngineCase(long id, UUID definitionId, String version, String name, String family, String assetId,
            Instant openedAt, int level, String tripId, Double latitude, Double longitude, Double speedKmh,
            Instant closedAt, long treatments, Integer slaMinutes, Long recurrence, String tripCode,
            JsonNode openingContext, JsonNode levelContext, String levelRule, List<LevelStep> levels,
            TripDetails trip) {
        this(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude, longitude,
                speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, openingContext, levelContext,
                levelRule, levels, trip, null, null, null);
    }

    @SuppressWarnings("java:S107")
    public EngineCase(long id, UUID definitionId, String version, String name, String family, String assetId,
            Instant openedAt, int level, String tripId, Double latitude, Double longitude, Double speedKmh,
            Instant closedAt, long treatments, Integer slaMinutes, Long recurrence, String tripCode) {
        this(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude, longitude,
                speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, null, null, null, List.of(), null, null,
                null, null);
    }

    @SuppressWarnings("java:S107")
    public EngineCase(long id, UUID definitionId, String version, String name, String family, String assetId,
            Instant openedAt, int level, String tripId, Double latitude, Double longitude, Double speedKmh,
            Instant closedAt, long treatments, Integer slaMinutes, Long recurrence) {
        this(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude, longitude,
                speedKmh, closedAt, treatments, slaMinutes, recurrence, null, null, null, null, List.of(), null,
                null, null, null);
    }

    public EngineCase withLevel(JsonNode opening, JsonNode context, String rule, List<LevelStep> steps) {
        return new EngineCase(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude,
                longitude, speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, opening, context, rule, steps,
                trip, closingContext, ignored, returnedAt);
    }

    public EngineCase withTrip(TripDetails details) {
        return new EngineCase(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude,
                longitude, speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, openingContext,
                levelContext, levelRule, levels, details, closingContext, ignored, returnedAt);
    }

    public EngineCase withClosing(JsonNode context) {
        return new EngineCase(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude,
                longitude, speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, openingContext,
                levelContext, levelRule, levels, trip, context, ignored, returnedAt);
    }

    public EngineCase withHold(Ignored hold, Instant returned) {
        return new EngineCase(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude,
                longitude, speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, openingContext,
                levelContext, levelRule, levels, trip, closingContext, hold, returned);
    }

    public long symptomId() {
        return -id;
    }

    /** The case id behind a Control Tower symptom id, or empty for a GPS database symptom. */
    public static OptionalLong caseId(long symptomId) {
        return symptomId < 0 ? OptionalLong.of(-symptomId) : OptionalLong.empty();
    }
}

package com.microboxlabs.miot.symptoms.cases;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.OptionalLong;
import java.util.UUID;

/**
 * A case the symptom evaluator opened: its OPENED transition, ACTIVE or TEST. In the Control Tower its symptom id is
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
 * @param levelAt     when it reached its current level (its latest level change, else its opening), or null when
 *                    not read
 * @param test        its symptom was in TEST when it opened: it is in no list or count, but can be treated and closed
 */
public record EngineCase(long id, UUID definitionId, String version, String name, String family, String assetId,
        Instant openedAt, int level, String tripId, Double latitude, Double longitude, Double speedKmh,
        Instant closedAt, long treatments, Integer slaMinutes, Long recurrence, String tripCode,
        JsonNode openingContext, JsonNode levelContext, String levelRule, List<LevelStep> levels,
        TripDetails trip, JsonNode closingContext, Ignored ignored, Instant returnedAt, Instant levelAt,
        boolean test) {

    /**
     * A hold on the case: since when, until when (null until the trip ends), what it covers and who set it.
     *
     * @param treatmentId the hold's treatment
     */
    public record Ignored(String treatmentId, Instant since, Instant until, boolean untilTripEnd, String scope,
            String by) {
    }

    /**
     * Names from the case's live trip; each null when the trip does not have it.
     *
     * @param assetId the vehicle the trip is on now, which differs from the case's after a truck change
     */
    public record TripDetails(String driver, String carrier, String origin, String destination, String assetId) {
        public TripDetails(String driver, String carrier, String origin, String destination) {
            this(driver, carrier, origin, destination, null);
        }
    }

    /**
     * The case reached {@code level} at {@code at}. A speed case's change also has the speed and the limit it was
     * compared with; both null for any other symptom.
     *
     * @param speedKmh   the frame's speed, rounded as the speed rules round it
     * @param speedLimit null when the change kept no limit and none can be derived
     */
    public record LevelStep(Instant at, int level, Double speedKmh, SpeedLimit speedLimit) {

        public LevelStep(Instant at, int level) {
            this(at, level, null, null);
        }
    }

    /**
     * The limit a speed rule compared the speed with.
     *
     * @param source {@code road} (the road network's limit) or {@code custom} (the organization's own)
     * @param zone   the own limit's zone name, or null
     */
    public record SpeedLimit(double kmh, String source, String zone) {

        public static final String CUSTOM = "custom";
        public static final String ROAD = "road";

        /**
         * The limit of a change of a symptom whose measure reads {@code source}'s limit: the one its context kept
         * ({@code speed_limit}), else the speed minus the measure, as the speed templates measure the excess. Null
         * without a source, or when neither gives a positive limit.
         */
        public static SpeedLimit of(String source, JsonNode kept, Double speedKmh, Double measure) {
            if (source == null) {
                return null;
            }
            if (kept != null && kept.isObject()) {
                boolean custom = CUSTOM.equals(source);
                JsonNode kmh = kept.path(custom ? "custom_kmh" : "road_kmh");
                if (kmh.isNumber() && kmh.asDouble() > 0) {
                    JsonNode zone = kept.path("zone_name");
                    return new SpeedLimit(kmh.asDouble(), source, custom && zone.isTextual() ? zone.asText() : null);
                }
            }
            if (speedKmh == null || measure == null) {
                return null;
            }
            double derived = speedKmh - measure;
            return derived > 0 ? new SpeedLimit(derived, source, null) : null;
        }

        /**
         * Recognizes the speed templates' excess measures only. Other arithmetic, conditional or combined
         * measures cannot safely derive an applied limit from the speed and measure.
         */
        public static String source(String measureExpression) {
            String expression = compact(measureExpression);
            for (String speed : List.of("signal.frame.gps.speed", "signal.gps.speed_kmh",
                    "double(int(signal.frame.gps.speed+0.5))")) {
                if (expression.equals(speed + "-signal.road.maxspeed_custom")) {
                    return CUSTOM;
                }
                if (expression.equals(speed + "-signal.road.maxspeed_osm")) {
                    return ROAD;
                }
            }
            return null;
        }

        /** Match the rounding of the version that computed the measure; older templates used raw speed. */
        public static double ruleSpeed(String expression, double speed) {
            return compact(expression).startsWith("double(int(") ? Math.round(speed) : speed;
        }

        private static String compact(String expression) {
            return expression == null ? "" : expression.replaceAll("\\s+", "");
        }
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
                levelRule, levels, null, null, null, null, null, false);
    }

    @SuppressWarnings("java:S107")
    public EngineCase(long id, UUID definitionId, String version, String name, String family, String assetId,
            Instant openedAt, int level, String tripId, Double latitude, Double longitude, Double speedKmh,
            Instant closedAt, long treatments, Integer slaMinutes, Long recurrence, String tripCode,
            JsonNode openingContext, JsonNode levelContext, String levelRule, List<LevelStep> levels,
            TripDetails trip) {
        this(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude, longitude,
                speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, openingContext, levelContext,
                levelRule, levels, trip, null, null, null, null, false);
    }

    @SuppressWarnings("java:S107")
    public EngineCase(long id, UUID definitionId, String version, String name, String family, String assetId,
            Instant openedAt, int level, String tripId, Double latitude, Double longitude, Double speedKmh,
            Instant closedAt, long treatments, Integer slaMinutes, Long recurrence, String tripCode) {
        this(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude, longitude,
                speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, null, null, null, List.of(), null, null,
                null, null, null, false);
    }

    @SuppressWarnings("java:S107")
    public EngineCase(long id, UUID definitionId, String version, String name, String family, String assetId,
            Instant openedAt, int level, String tripId, Double latitude, Double longitude, Double speedKmh,
            Instant closedAt, long treatments, Integer slaMinutes, Long recurrence) {
        this(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude, longitude,
                speedKmh, closedAt, treatments, slaMinutes, recurrence, null, null, null, null, List.of(), null,
                null, null, null, null, false);
    }

    public EngineCase withLevel(JsonNode opening, JsonNode context, String rule, List<LevelStep> steps) {
        return new EngineCase(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude,
                longitude, speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, opening, context, rule, steps,
                trip, closingContext, ignored, returnedAt, levelAt, test);
    }

    public EngineCase withTrip(TripDetails details) {
        return new EngineCase(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude,
                longitude, speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, openingContext,
                levelContext, levelRule, levels, details, closingContext, ignored, returnedAt, levelAt, test);
    }

    public EngineCase withClosing(JsonNode context) {
        return new EngineCase(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude,
                longitude, speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, openingContext,
                levelContext, levelRule, levels, trip, context, ignored, returnedAt, levelAt, test);
    }

    public EngineCase withHold(Ignored hold, Instant returned) {
        return new EngineCase(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude,
                longitude, speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, openingContext,
                levelContext, levelRule, levels, trip, closingContext, hold, returned, levelAt, test);
    }

    public EngineCase withLevelAt(Instant at) {
        return new EngineCase(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude,
                longitude, speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, openingContext,
                levelContext, levelRule, levels, trip, closingContext, ignored, returnedAt, at, test);
    }

    public EngineCase withTest(boolean inTest) {
        return new EngineCase(id, definitionId, version, name, family, assetId, openedAt, level, tripId, latitude,
                longitude, speedKmh, closedAt, treatments, slaMinutes, recurrence, tripCode, openingContext,
                levelContext, levelRule, levels, trip, closingContext, ignored, returnedAt, levelAt, inTest);
    }

    /** When its current level's SLA started: it reached the level, or came back from a hold after that. */
    public Instant slaStart() {
        Instant since = levelAt != null ? levelAt : openedAt;
        return returnedAt != null && returnedAt.isAfter(since) ? returnedAt : since;
    }

    /** When its current level's SLA runs out, or null when the level has none. */
    public Instant slaDeadline() {
        return slaMinutes == null || slaMinutes <= 0 ? null : slaStart().plusSeconds(slaMinutes * 60L);
    }

    public long symptomId() {
        return -id;
    }

    /** The case id behind a Control Tower symptom id, or empty for a GPS database symptom. */
    public static OptionalLong caseId(long symptomId) {
        return symptomId < 0 ? OptionalLong.of(-symptomId) : OptionalLong.empty();
    }
}

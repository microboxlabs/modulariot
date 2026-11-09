package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The evaluator's cases: open ones, one by id, the operator's close, and the close after a state change. */
public interface EngineCaseStore {

    /** The most recent open cases, at most a page of them. */
    List<EngineCase> open(String tenantCode);

    /** Every open case of this exact vehicle, without the tower's page limit. */
    default List<EngineCase> openForAsset(String tenantCode, String assetId) {
        return open(tenantCode).stream().filter(c -> c.assetId().equals(assetId)).toList();
    }

    /** The most recent cases that match, at most a page of them. */
    List<EngineCase> list(String tenantCode, CaseFilter filter);

    /** The open cases no hold covers, counted by level and by whether they have an open treatment. */
    List<OpenCount> openCounts(String tenantCode);

    record TowerCounts(List<OpenCount> active, long ignored) { }

    /**
     * The tower inbox's counts, read from one snapshot by persistent stores: the open cases whose current level
     * asks for an operator ({@link CaseFilter#operatorOnly}).
     */
    default TowerCounts towerCounts(String tenantCode) {
        return new TowerCounts(openCounts(tenantCode), ignoredCount(tenantCode));
    }


    /** The open cases a hold covers now. */
    default long ignoredCount(String tenantCode) {
        return 0;
    }

    /** Every open case's vehicle, symptom and current level, not capped to a page; held cases are left out. */
    List<OpenLevel> openLevels(String tenantCode);

    Optional<EngineCase> find(String tenantCode, long caseId);

    /** The cases opened from {@code from} until before {@code to}, counted by symptom and level. */
    List<LevelCount> openedCounts(String tenantCode, Instant from, Instant to);

    /** The cases opened from {@code from} until before {@code to}, in id order after {@code afterId}. */
    List<DueCase> openedPage(String tenantCode, Instant from, Instant to, long afterId, int limit);

    /** When the organization's first case opened. */
    Optional<Instant> firstOpening(String tenantCode);

    /**
     * When the vehicle's latest case before {@code caseId} opened, of any symptom, if that was after {@code after}
     * and before {@code before}.
     */
    Optional<Instant> previousOpening(String tenantCode, String assetId, long caseId, Instant after, Instant before);

    /** The note rule's timeline entries on the case, oldest first, at most {@link #MAX_NOTES}. */
    default List<CaseNote> notes(String tenantCode, long caseId) {
        return List.of();
    }

    /** Historical holds whose coverage overlaps this case, including holds that have ended. */
    default List<EngineCase.Ignored> holds(String tenantCode, EngineCase engineCase, Instant until) {
        return List.of();
    }

    int MAX_NOTES = 200;

    /**
     * A timeline entry the note rule wrote: the matching GPS event's type and description (null when the rule did
     * not hold for one event) and its time; {@code recordedAt} is the frame's.
     */
    record CaseNote(Instant recordedAt, String eventType, String description, Instant at) {
    }

    /**
     * Records that an operator closed the case at {@code at}; false when it was already closed, so of two
     * overlapping closes only one returns true.
     */
    boolean close(String tenantCode, long caseId, String actor, Instant at);

    /**
     * Closes each open case whose state is no longer its symptom's state, as when the symptom moved between TEST
     * and ACTIVE or was turned off, and returns the cases it closed. Each gets a CLOSED transition in its own state
     * with {@code reason}. A case already closed is left alone, so running it again closes nothing.
     *
     * @param tenantCode   null for every organization
     * @param definitionId null for every symptom
     */
    default List<StaleCase> closeStale(String tenantCode, UUID definitionId, Instant at, String reason) {
        return List.of();
    }

    /**
     * Closes the open cases of the trip among {@code definitionIds}, whatever their level, with {@code reason} as
     * {@code closed_by} and in the context, and returns them. A case already closed is left alone.
     *
     * @param definitionIds null for every symptom of the organization
     */
    default List<StaleCase> closeTrip(String tenantCode, String tripId, List<UUID> definitionIds, Instant at,
            String reason) {
        return List.of();
    }

    /** The evaluator's maximum and latest context, including frames without a level change. */
    record ClosingFrame(double maxMeasure, java.util.Map<String, Object> context) {
    }

    /** As {@link #closeTrip}, using matching episode evidence when it is still available. */
    default List<StaleCase> closeTrip(String tenantCode, String tripId, List<UUID> definitionIds, Instant at,
            String reason, java.util.function.Function<StaleCase, ClosingFrame> frames) {
        return closeTrip(tenantCode, tripId, definitionIds, at, reason);
    }

    /** A case {@link #closeStale} or {@link #closeTrip} closed; {@code id} is its OPENED transition's. */
    record StaleCase(String tenantCode, long id, UUID definitionId, String version, boolean test, String assetId,
            int level, String tripId, Double latitude, Double longitude, Double speedKmh, Instant openedAt) {

        public long symptomId() {
            return -id;
        }
    }

    record OpenCount(int level, boolean underTreatment, long count) {
    }

    record OpenLevel(String assetId, String name, int level, EngineCase.LevelStep speedStep) {
        public OpenLevel(String assetId, String name, int level) {
            this(assetId, name, level, null);
        }
    }

    /**
     * Each value null for any. Without {@code from} and {@code to}, only open cases; with them, the cases active
     * in the range: opened before {@code to} and still open or closed at or after {@code from}. {@code assetId} matches part of the vehicle id,
     * {@code symptomName} the whole name ignoring case, {@code level} the case's current level.
     * {@code underTreatmentOnly} requires an open treatment, independently of severity. {@code ignoredOnly} keeps
     * the open cases a hold covers; otherwise, without dates, those are left out.
     *
     * <p>The trip filters match the case's live trip, so a case without one matches none of them. {@code driverId}
     * is the RUT of either driver, {@code carrierId} the carrier's RUT or id; both ignore dots, dashes, spaces and
     * case. {@code origin} and {@code destination} are the whole place name, ignoring case and outer spaces.
     *
     * <p>{@code operatorOnly} keeps the cases whose current level has {@code response.operator: true} in the
     * published version the case runs on: the tower inbox. A level with {@code operator: false} or no response is
     * left out.
     */
    record CaseFilter(String tripId, String assetId, String symptomName, Integer level, Instant from, Instant to,
            String driverId, String carrierId, String origin, String destination, boolean underTreatmentOnly,
            boolean ignoredOnly, boolean operatorOnly) {

        public static final CaseFilter OPEN = new CaseFilter(null, null, null, null, null, null);

        public CaseFilter(String tripId, String assetId, String symptomName, Integer level, Instant from,
                Instant to) {
            this(tripId, assetId, symptomName, level, from, to, null, null, null, null, false, false, false);
        }

        @SuppressWarnings("java:S107")
        public CaseFilter(String tripId, String assetId, String symptomName, Integer level, Instant from,
                Instant to, String driverId, String carrierId, String origin, String destination) {
            this(tripId, assetId, symptomName, level, from, to, driverId, carrierId, origin, destination, false,
                    false, false);
        }

        public CaseFilter withOpenTreatment() {
            return new CaseFilter(tripId, assetId, symptomName, null, from, to, driverId, carrierId, origin,
                    destination, true, ignoredOnly, operatorOnly);
        }

        public CaseFilter withIgnored() {
            return new CaseFilter(tripId, assetId, symptomName, null, from, to, driverId, carrierId, origin,
                    destination, underTreatmentOnly, true, operatorOnly);
        }

        /** Only the cases whose current level asks for an operator: the tower inbox. */
        public CaseFilter forOperator() {
            return new CaseFilter(tripId, assetId, symptomName, level, from, to, driverId, carrierId, origin,
                    destination, underTreatmentOnly, ignoredOnly, true);
        }

        /** Whether it filters by a field of the case's trip. */
        public boolean byTrip() {
            return driverId != null || carrierId != null || origin != null || destination != null;
        }

        public boolean openOnly() {
            return from == null && to == null;
        }
    }

    record LevelCount(UUID definitionId, int level, long count) {
    }

    /**
     * A case and the SLA of its current level, which runs from {@code levelSince}: when the case reached that
     * level.
     */
    record DueCase(long id, UUID definitionId, Instant levelSince, Integer slaMinutes) {

        public long symptomId() {
            return -id;
        }
    }
}

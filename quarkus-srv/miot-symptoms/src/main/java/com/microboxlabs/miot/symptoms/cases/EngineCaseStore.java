package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The evaluator's cases: open ones, one by id, and the operator's close. */
public interface EngineCaseStore {

    /** The most recent open cases, at most a page of them. */
    List<EngineCase> open(String tenantCode);

    /** The most recent cases that match, at most a page of them. */
    List<EngineCase> list(String tenantCode, CaseFilter filter);

    /** The open cases no hold covers, counted by level and by whether they have an open treatment. */
    List<OpenCount> openCounts(String tenantCode);

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

    /**
     * Records that an operator closed the case at {@code at}; false when it was already closed, so of two
     * overlapping closes only one returns true.
     */
    boolean close(String tenantCode, long caseId, String actor, Instant at);

    record OpenCount(int level, boolean underTreatment, long count) {
    }

    record OpenLevel(String assetId, String name, int level) {
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
     */
    record CaseFilter(String tripId, String assetId, String symptomName, Integer level, Instant from, Instant to,
            String driverId, String carrierId, String origin, String destination, boolean underTreatmentOnly,
            boolean ignoredOnly) {

        public static final CaseFilter OPEN = new CaseFilter(null, null, null, null, null, null);

        public CaseFilter(String tripId, String assetId, String symptomName, Integer level, Instant from,
                Instant to) {
            this(tripId, assetId, symptomName, level, from, to, null, null, null, null, false, false);
        }

        @SuppressWarnings("java:S107")
        public CaseFilter(String tripId, String assetId, String symptomName, Integer level, Instant from,
                Instant to, String driverId, String carrierId, String origin, String destination) {
            this(tripId, assetId, symptomName, level, from, to, driverId, carrierId, origin, destination, false,
                    false);
        }

        public CaseFilter withOpenTreatment() {
            return new CaseFilter(tripId, assetId, symptomName, null, from, to, driverId, carrierId, origin,
                    destination, true, ignoredOnly);
        }

        public CaseFilter withIgnored() {
            return new CaseFilter(tripId, assetId, symptomName, null, from, to, driverId, carrierId, origin,
                    destination, underTreatmentOnly, true);
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

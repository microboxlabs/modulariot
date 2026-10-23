package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The evaluator's cases: open ones, one by id, and the operator's close. */
public interface EngineCaseStore {

    /** The most recent open cases, at most a page of them. */
    List<EngineCase> open(String tenantCode);

    /** All the open cases, counted by level and by whether they have an open treatment. */
    List<OpenCount> openCounts(String tenantCode);

    Optional<EngineCase> find(String tenantCode, long caseId);

    /** The cases opened from {@code from} until before {@code to}, counted by symptom and level. */
    List<LevelCount> openedCounts(String tenantCode, Instant from, Instant to);

    /** The cases opened from {@code from} until before {@code to}, in id order after {@code afterId}. */
    List<EngineCase> openedPage(String tenantCode, Instant from, Instant to, long afterId, int limit);

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

    record LevelCount(UUID definitionId, int level, long count) {
    }
}

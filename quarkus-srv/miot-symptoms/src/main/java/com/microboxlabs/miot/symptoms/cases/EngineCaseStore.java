package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** The evaluator's cases: open ones, one by id, and the operator's close. */
public interface EngineCaseStore {

    /** The most recent open cases, at most a page of them. */
    List<EngineCase> open(String tenantCode);

    /** All the open cases, counted by level and by whether they have an open treatment. */
    List<OpenCount> openCounts(String tenantCode);

    Optional<EngineCase> find(String tenantCode, long caseId);

    /**
     * Records that an operator closed the case at {@code at}; false when it was already closed, so of two
     * overlapping closes only one returns true.
     */
    boolean close(String tenantCode, long caseId, String actor, Instant at);

    record OpenCount(int level, boolean underTreatment, long count) {
    }
}

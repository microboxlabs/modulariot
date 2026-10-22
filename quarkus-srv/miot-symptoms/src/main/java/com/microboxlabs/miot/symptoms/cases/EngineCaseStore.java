package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** The evaluator's cases: open ones, one by id, and the operator's close. */
public interface EngineCaseStore {

    List<EngineCase> open(String tenantCode);

    Optional<EngineCase> find(String tenantCode, long caseId);

    void close(String tenantCode, long caseId, String actor, Instant at);
}

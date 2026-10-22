package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** Engine cases for tests: whatever is added, closed by {@link #close}. */
public class InMemoryEngineCases implements EngineCaseStore {

    private final List<EngineCase> cases = new ArrayList<>();
    public final List<String> closedBy = new ArrayList<>();

    public void add(EngineCase c) {
        cases.add(c);
    }

    @Override
    public List<EngineCase> open(String tenantCode) {
        return cases.stream().filter(c -> c.closedAt() == null).toList();
    }

    @Override
    public Optional<EngineCase> find(String tenantCode, long caseId) {
        return cases.stream().filter(c -> c.id() == caseId).findFirst();
    }

    @Override
    public void close(String tenantCode, long caseId, String actor, Instant at) {
        cases.replaceAll(c -> c.id() != caseId ? c : new EngineCase(c.id(), c.definitionId(), c.version(), c.name(),
                c.family(), c.assetId(), c.openedAt(), c.level(), c.tripId(), c.latitude(), c.longitude(),
                c.speedKmh(), at, c.treatments()));
        closedBy.add(actor);
    }
}

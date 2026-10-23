package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/** Engine cases for tests: whatever is added, closed by {@link #close}. */
public class InMemoryEngineCases implements EngineCaseStore {

    private static final int PAGE = 200;

    private final List<EngineCase> cases = new ArrayList<>();
    public final List<String> closedBy = new ArrayList<>();
    public boolean down;

    public void add(EngineCase c) {
        cases.add(c);
    }

    /** Capped like the database store's page of open cases. */
    @Override
    public List<EngineCase> open(String tenantCode) {
        return cases.stream().filter(c -> c.closedAt() == null).limit(PAGE).toList();
    }

    @Override
    public List<OpenCount> openCounts(String tenantCode) {
        if (down) {
            throw new IllegalStateException("database down");
        }
        return cases.stream().filter(c -> c.closedAt() == null)
                .collect(Collectors.groupingBy(c -> List.of(c.level(), c.treatments() > 0), Collectors.counting()))
                .entrySet().stream()
                .map(e -> new OpenCount((Integer) e.getKey().get(0), (Boolean) e.getKey().get(1), e.getValue()))
                .toList();
    }

    @Override
    public Optional<EngineCase> find(String tenantCode, long caseId) {
        return cases.stream().filter(c -> c.id() == caseId).findFirst();
    }

    @Override
    public boolean close(String tenantCode, long caseId, String actor, Instant at) {
        if (cases.stream().noneMatch(c -> c.id() == caseId && c.closedAt() == null)) {
            return false;
        }
        cases.replaceAll(c -> c.id() != caseId ? c : new EngineCase(c.id(), c.definitionId(), c.version(), c.name(),
                c.family(), c.assetId(), c.openedAt(), c.level(), c.tripId(), c.latitude(), c.longitude(),
                c.speedKmh(), at, c.treatments(), c.slaMinutes(), c.recurrence()));
        closedBy.add(actor);
        return true;
    }
}

package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/** Engine cases for tests: whatever is added, closed by {@link #close}. */
public class InMemoryEngineCases implements EngineCaseStore {

    private static final int PAGE = 200;

    private final List<EngineCase> cases = new ArrayList<>();
    public final List<String> closedBy = new ArrayList<>();
    /** When a case reached its current level, by case id; its opening when absent. */
    public final Map<Long, Instant> levelSince = new HashMap<>();
    public boolean down;
    public int pages;

    public void add(EngineCase c) {
        cases.add(c);
    }

    /** Capped like the database store's page of open cases. */
    @Override
    public List<EngineCase> open(String tenantCode) {
        return cases.stream().filter(c -> c.closedAt() == null).limit(PAGE).toList();
    }

    @Override
    public List<EngineCase> list(String tenantCode, CaseFilter f) {
        return cases.stream()
                .filter(c -> f.openOnly() ? c.closedAt() == null
                        : (f.from() == null || c.closedAt() == null || !c.closedAt().isBefore(f.from()))
                                && (f.to() == null || c.openedAt().isBefore(f.to())))
                .filter(c -> f.tripId() == null || f.tripId().equals(c.tripId()))
                .filter(c -> f.assetId() == null
                        || c.assetId().toLowerCase().contains(f.assetId().toLowerCase()))
                .filter(c -> f.symptomName() == null || f.symptomName().equalsIgnoreCase(c.name()))
                .filter(c -> f.level() == null || f.level() == c.level())
                .sorted(Comparator.comparing(EngineCase::openedAt).reversed())
                .limit(PAGE).toList();
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
    public List<LevelCount> openedCounts(String tenantCode, Instant from, Instant to) {
        if (down) {
            throw new IllegalStateException("database down");
        }
        return opened(from, to).collect(Collectors.groupingBy(c -> List.of(c.definitionId(), c.level()),
                Collectors.counting())).entrySet().stream()
                .map(e -> new LevelCount((UUID) e.getKey().get(0), (Integer) e.getKey().get(1), e.getValue()))
                .toList();
    }

    @Override
    public List<DueCase> openedPage(String tenantCode, Instant from, Instant to, long afterId, int limit) {
        pages++;
        return opened(from, to).filter(c -> c.id() > afterId).sorted(Comparator.comparingLong(EngineCase::id))
                .limit(limit)
                .map(c -> new DueCase(c.id(), c.definitionId(), levelSince.getOrDefault(c.id(), c.openedAt()),
                        c.slaMinutes()))
                .toList();
    }

    @Override
    public Optional<Instant> firstOpening(String tenantCode) {
        return cases.stream().map(EngineCase::openedAt).min(Instant::compareTo);
    }

    private Stream<EngineCase> opened(Instant from, Instant to) {
        return cases.stream().filter(c -> !c.openedAt().isBefore(from) && c.openedAt().isBefore(to));
    }

    @Override
    public Optional<Instant> previousOpening(String tenantCode, String assetId, long caseId, Instant after,
            Instant before) {
        return cases.stream().filter(c -> c.assetId().equals(assetId) && c.id() < caseId)
                .map(EngineCase::openedAt).filter(at -> at.isAfter(after) && at.isBefore(before))
                .max(Instant::compareTo);
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

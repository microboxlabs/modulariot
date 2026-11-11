package com.microboxlabs.miot.symptoms.cases;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
    /** Live trips by trip id, for the trip filters. */
    public final Map<String, Trip> trips = new HashMap<>();

    /** A live trip as the trip filters read it. */
    public record Trip(String driverRut, String secondDriverRut, String carrierId, String carrierRut, String origin,
            String destination) {
    }
    public int pages;
    /** The note rule's entries by case id. */
    public final Map<Long, List<CaseNote>> notes = new HashMap<>();

    @Override
    public List<CaseNote> notes(String tenantCode, long caseId) {
        return notes.getOrDefault(caseId, List.of());
    }

    public void add(EngineCase c) {
        cases.add(c);
    }

    /**
     * The levels whose response asks for an operator, by symptom, as the published version says. A symptom
     * without an entry asks for one at every level.
     */
    public final Map<UUID, Set<Integer>> operatorLevels = new HashMap<>();

    /** Stored per-case decisions override the version fallback. */
    public final Map<Long, Boolean> operatorRequired = new HashMap<>();
    /** Cases covered by an active hold. */
    public final Set<Long> held = new HashSet<>();

    private boolean needsOperator(EngineCase c) {
        if (operatorRequired.containsKey(c.id())) {
            return operatorRequired.get(c.id());
        }
        Set<Integer> levels = operatorLevels.get(c.definitionId());
        return levels == null || levels.contains(c.level());
    }

    /** The case moves to {@code level}, as the evaluator's level change does. */
    public void changeLevel(long caseId, int level) {
        changeLevel(caseId, level, null);
    }

    /** The case moves to {@code level} at {@code at}. */
    public void changeLevel(long caseId, int level, Instant at) {
        cases.replaceAll(c -> c.id() == caseId ? new EngineCase(c.id(), c.definitionId(), c.version(), c.name(),
                c.family(), c.assetId(), c.openedAt(), level, c.tripId(), c.latitude(), c.longitude(),
                c.speedKmh(), c.closedAt(), c.treatments(), c.slaMinutes(), c.recurrence(), c.tripCode())
                .withLevelAt(at) : c);
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
                .filter(c -> !f.underTreatmentOnly() || c.treatments() > 0)
                .filter(c -> !f.operatorOnly() || needsOperator(c))
                .filter(c -> f.ignoredOnly() ? held.contains(c.id()) && c.closedAt() == null
                        : !f.openOnly() || !held.contains(c.id()))
                .filter(c -> !f.byTrip() || matchesTrip(trips.get(c.tripId()), f))
                .sorted(Comparator.comparing(EngineCase::openedAt).reversed())
                .limit(PAGE).toList();
    }

    /** The vehicle of each trip that departed and has not ended, by trip id; its fields are in {@link #trips}. */
    public final Map<String, String> onTrip = new HashMap<>();

    @Override
    public long vehiclesOnTrip(String tenantCode, CaseFilter f) {
        return onTrip.entrySet().stream()
                .filter(e -> f.tripId() == null || f.tripId().equals(e.getKey()))
                .filter(e -> f.assetId() == null || e.getValue().toLowerCase().contains(f.assetId().toLowerCase()))
                .filter(e -> !f.byTrip() || matchesTrip(trips.get(e.getKey()), f))
                .map(Map.Entry::getValue).distinct().count();
    }

    private static boolean matchesTrip(Trip t, CaseFilter f) {
        if (t == null) {
            return false;
        }
        return (f.driverId() == null || same(plain(f.driverId()), plain(t.driverRut()))
                        || same(plain(f.driverId()), plain(t.secondDriverRut())))
                && (f.carrierId() == null || same(plain(f.carrierId()), plain(t.carrierRut()))
                        || f.carrierId().trim().equals(t.carrierId()))
                && (f.origin() == null || f.origin().strip().equalsIgnoreCase(strip(t.origin())))
                && (f.destination() == null || f.destination().strip().equalsIgnoreCase(strip(t.destination())));
    }

    private static boolean same(String a, String b) {
        return a != null && !a.isEmpty() && a.equals(b);
    }

    private static String plain(String v) {
        return v == null ? null : v.replaceAll("[^0-9A-Za-z]", "").toUpperCase(java.util.Locale.ROOT);
    }

    private static String strip(String v) {
        return v == null ? null : v.strip();
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
    public TowerCounts towerCounts(String tenantCode) {
        if (down) {
            throw new IllegalStateException("database down");
        }
        List<OpenCount> active = cases.stream().filter(c -> c.closedAt() == null && needsOperator(c))
                .collect(Collectors.groupingBy(c -> List.of(c.level(), c.treatments() > 0), Collectors.counting()))
                .entrySet().stream()
                .map(e -> new OpenCount((Integer) e.getKey().get(0), (Boolean) e.getKey().get(1), e.getValue()))
                .toList();
        return new TowerCounts(active, ignoredCount(tenantCode));
    }

    @Override
    public List<OpenLevel> openLevels(String tenantCode) {
        if (down) {
            throw new IllegalStateException("database down");
        }
        return cases.stream().filter(c -> c.closedAt() == null)
                .map(c -> new OpenLevel(c.assetId(), c.name(), c.level(),
                        c.levels().isEmpty() ? null : c.levels().get(c.levels().size() - 1))).toList();
    }

    /** The organization's symptoms, for {@link #tripSymptoms}. */
    public final Map<UUID, Definition> definitions = new java.util.LinkedHashMap<>();

    public record Definition(String key, String name, String family, String icon, String state) {
    }

    /** A trip matches by the case's trip id, or by its trip code as the trips module's service code. */
    @Override
    public List<TripSymptom> tripSymptoms(String tenantCode, String trip) {
        Map<UUID, List<EngineCase>> byDefinition = cases.stream().filter(c -> !c.test())
                .filter(c -> trip.equals(c.tripId()) || trip.equals(c.tripCode()))
                .collect(Collectors.groupingBy(EngineCase::definitionId));
        List<TripSymptom> out = new ArrayList<>();
        definitions.forEach((id, d) -> {
            List<EngineCase> found = byDefinition.getOrDefault(id, List.of());
            if (!"ACTIVE".equals(d.state()) && found.isEmpty()) {
                return;
            }
            int max = found.stream().mapToInt(c -> Math.max(c.level(), c.levels().stream()
                    .mapToInt(EngineCase.LevelStep::level).max().orElse(0))).max().orElse(0);
            EngineCase latest = found.stream().max(Comparator.comparing(EngineCase::openedAt)).orElse(null);
            out.add(new TripSymptom(id, d.key(), d.name(), d.family(), d.icon(), found.size(),
                    found.stream().filter(c -> c.closedAt() == null).count(), max,
                    latest == null ? null : latest.tripId(),
                    found.stream().map(EngineCase::openedAt).min(Comparator.naturalOrder()).orElse(null),
                    latest == null ? null : latest.openedAt()));
        });
        out.sort(Comparator.comparing((TripSymptom t) -> t.name().toLowerCase(java.util.Locale.ROOT)));
        return out;
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
                Collectors.toList())).entrySet().stream()
                .map(e -> new LevelCount((UUID) e.getKey().get(0), (Integer) e.getKey().get(1), e.getValue().size(),
                        e.getValue().stream().filter(c -> !needsOperator(c)).count()))
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
                c.speedKmh(), at, c.treatments(), c.slaMinutes(), c.recurrence(), c.tripCode()));
        closedBy.add(actor);
        return true;
    }
}

package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.SymptomSummary;
import com.microboxlabs.miot.symptoms.domain.TowerSettings;
import com.microboxlabs.miot.symptoms.engine.EngineCase;
import com.microboxlabs.miot.symptoms.engine.LevelCount;
import com.microboxlabs.miot.symptoms.engine.SymptomEngine;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService;
import com.microboxlabs.miot.symptoms.store.TreatmentStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.jboss.logging.Logger;

/**
 * The numbers over the catalog: cases per week by level, operator load per
 * shift, last week's SLA and recent changes.
 *
 * <p>Cases come from the engine that runs today. Each engine symptom name is
 * credited to one definition, picked as the operator response picks it: the
 * name or icon matches, ACTIVE before TEST before OFF, then the most recently
 * changed. Counts are engine case rows; a case that escalates has one row per
 * level it reached.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomStatsService {

    public static final int WINDOW_DAYS = 90;
    static final int LEVELS = 4;
    static final int TOP = 3;
    /** Cases read per engine query for last week's SLA. */
    static final int SLA_PAGE = 2000;

    private static final Logger LOG = Logger.getLogger(SymptomStatsService.class);

    private final SymptomCatalogService catalog;
    private final SymptomEngine engine;
    private final TreatmentStore treatments;
    private final TowerSettingsService settings;
    private final Supplier<OffsetDateTime> clock;

    public record SymptomStats(boolean engineAvailable, int windowDays, List<PerSymptom> symptoms, Totals totals,
            Operators operators, Changes changes) {
    }

    /** One definition's weekly averages; {@code operatorWeek} counts levels that need an operator. */
    public record PerSymptom(UUID definitionId, List<Long> weekByLevel, long week, long operatorWeek) {
    }

    /**
     * Weekly averages over every engine case. {@code perShift} counts only ACTIVE symptoms at levels that need an
     * operator; {@code topShare} is the share of the busiest definitions, or null without cases.
     */
    public record Totals(List<Long> weekByLevel, long week, long perShift, TopShare topShare) {
    }

    public record TopShare(List<UUID> definitionIds, double share) {
    }

    /** {@code slaMetLastWeek} is a fraction from 0 to 1, or null when no case needed an operator. */
    public record Operators(Integer operators, int shiftHours, Integer capacityPerShift, Double slaMetLastWeek) {
    }

    public record Changes(long drafts, LastPublished lastPublished) {
    }

    public record LastPublished(UUID definitionId, String name, String version, OffsetDateTime at, String by,
            String reason) {
    }

    @Inject
    public SymptomStatsService(SymptomCatalogService catalog, SymptomEngine engine, TreatmentStore treatments,
            TowerSettingsService settings) {
        this(catalog, engine, treatments, settings, () -> OffsetDateTime.now(ZoneOffset.UTC));
    }

    SymptomStatsService(SymptomCatalogService catalog, SymptomEngine engine, TreatmentStore treatments,
            TowerSettingsService settings, Supplier<OffsetDateTime> clock) {
        this.catalog = catalog;
        this.engine = engine;
        this.treatments = treatments;
        this.settings = settings;
        this.clock = clock;
    }

    public SymptomStats stats(String tenantCode) {
        List<SymptomSummary> all = catalog.list(tenantCode);
        TowerSettings team = settings.get(tenantCode);
        Changes changes = changes(all);
        OffsetDateTime now = clock.get();
        Optional<List<LevelCount>> read = engineCounts(tenantCode, now);
        if (read.isEmpty()) {
            return new SymptomStats(false, WINDOW_DAYS, List.of(), new Totals(zeros(), 0, 0, null),
                    operators(team, null), changes);
        }
        List<LevelCount> counts = read.get();

        Map<String, SymptomSummary> owners = new HashMap<>();
        long[] totalRaw = new long[LEVELS];
        Map<UUID, long[]> raw = new LinkedHashMap<>();
        for (LevelCount c : counts) {
            if (c.icu() < 1 || c.icu() > LEVELS) {
                continue;
            }
            totalRaw[c.icu() - 1] += c.cases();
            SymptomSummary owner = owners.computeIfAbsent(c.symptomName(), n -> owner(all, n).orElse(null));
            if (owner != null) {
                raw.computeIfAbsent(owner.definition().id(), id -> new long[LEVELS])[c.icu() - 1] += c.cases();
            }
        }

        List<PerSymptom> perSymptom = new ArrayList<>();
        long operatorWeekActive = 0;
        for (SymptomSummary s : all) {
            long[] levels = raw.get(s.definition().id());
            if (levels == null) {
                continue;
            }
            List<Long> week = weekly(levels);
            long operatorWeek = operatorLevels(s.current()).stream().mapToLong(icu -> week.get(icu - 1)).sum();
            if (s.definition().state() == SymptomState.ACTIVE) {
                operatorWeekActive += operatorWeek;
            }
            perSymptom.add(new PerSymptom(s.definition().id(), week, sum(week), operatorWeek));
        }

        List<Long> totalWeek = weekly(totalRaw);
        long total = sum(totalWeek);
        Totals totals = new Totals(totalWeek, total, Math.round(operatorWeekActive / team.shiftsPerWeek()),
                topShare(perSymptom, total));
        Double sla = slaMetLastWeek(tenantCode, owners, now);
        return new SymptomStats(true, WINDOW_DAYS, perSymptom, totals, operators(team, sla), changes);
    }

    /** The engine's counts for the window; empty when it is not connected or fails. */
    private Optional<List<LevelCount>> engineCounts(String tenantCode, OffsetDateTime now) {
        if (!engine.available()) {
            return Optional.empty();
        }
        try {
            return Optional.of(engine.levelCounts(tenantCode, now.minusDays(WINDOW_DAYS), now));
        } catch (RuntimeException e) {
            LOG.warnf(e, "Engine counts not available for tenant=%s", tenantCode);
            return Optional.empty();
        }
    }

    /** The definition an engine symptom name is credited to. */
    static Optional<SymptomSummary> owner(List<SymptomSummary> all, String engineName) {
        if (engineName == null || engineName.isBlank()) {
            return Optional.empty();
        }
        String wanted = engineName.trim();
        return all.stream()
                .filter(s -> wanted.equalsIgnoreCase(s.definition().name())
                        || wanted.equalsIgnoreCase(s.definition().icon()))
                .min(Comparator.comparingInt((SymptomSummary s) -> rank(s.definition().state()))
                        .thenComparing(s -> s.definition().updatedAt(), Comparator.reverseOrder()));
    }

    private static int rank(SymptomState state) {
        return switch (state) {
            case ACTIVE -> 0;
            case TEST -> 1;
            case OFF -> 2;
        };
    }

    /** ICU levels of the version in force that apply and need an operator. */
    static List<Integer> operatorLevels(SymptomVersion current) {
        if (current == null || current.spec() == null || current.spec().levels() == null) {
            return List.of();
        }
        return current.spec().levels().stream()
                .filter(l -> l.applies() && l.icu() >= 1 && l.icu() <= LEVELS)
                .filter(l -> l.response() != null && l.response().operator())
                .map(SymptomSpec.Level::icu)
                .distinct()
                .toList();
    }

    private static List<Long> weekly(long[] windowCounts) {
        return Arrays.stream(windowCounts).map(n -> Math.round(n * 7.0 / WINDOW_DAYS)).boxed().toList();
    }

    private static List<Long> zeros() {
        return List.of(0L, 0L, 0L, 0L);
    }

    private static long sum(List<Long> values) {
        return values.stream().mapToLong(Long::longValue).sum();
    }

    private static TopShare topShare(List<PerSymptom> perSymptom, long total) {
        if (total <= 0) {
            return null;
        }
        List<PerSymptom> top = perSymptom.stream()
                .filter(p -> p.week() > 0)
                .sorted(Comparator.comparingLong(PerSymptom::week).reversed())
                .limit(TOP)
                .toList();
        if (top.isEmpty()) {
            return null;
        }
        long busiest = top.stream().mapToLong(PerSymptom::week).sum();
        return new TopShare(top.stream().map(PerSymptom::definitionId).toList(), Math.min(1.0, (double) busiest / total));
    }

    /**
     * Share of last week's cases at operator levels of ACTIVE symptoms that an
     * operator took within the level's SLA. Cases whose SLA has not run out
     * yet are left out; so are levels without an SLA.
     */
    private Double slaMetLastWeek(String tenantCode, Map<String, SymptomSummary> owners, OffsetDateTime now) {
        Map<Long, OffsetDateTime> deadlines = new HashMap<>();
        try {
            owners.forEach((name, s) -> {
                if (s != null && s.definition().state() == SymptomState.ACTIVE) {
                    addDueCases(tenantCode, name, slaByLevel(s.current()), now, deadlines);
                }
            });
        } catch (RuntimeException e) {
            LOG.warnf(e, "Engine cases not available for the SLA of tenant=%s", tenantCode);
            return null;
        }
        if (deadlines.isEmpty()) {
            return null;
        }
        Map<Long, OffsetDateTime> taken = treatments.firstOpenedAt(tenantCode, deadlines.keySet());
        long met = deadlines.entrySet().stream()
                .filter(d -> takenInTime(taken.get(d.getKey()), d.getValue()))
                .count();
        return (double) met / deadlines.size();
    }

    /** Adds to {@code out} each case of the last 7 days at a level with an SLA, by id, with its deadline. */
    private void addDueCases(String tenantCode, String engineName, Map<Integer, Integer> sla, OffsetDateTime now,
            Map<Long, OffsetDateTime> out) {
        if (sla.isEmpty()) {
            return;
        }
        List<Integer> levels = List.copyOf(sla.keySet());
        long after = 0;
        List<EngineCase> page;
        do {
            page = engine.casesPage(tenantCode, engineName, now.minusDays(7), now, levels, after, SLA_PAGE);
            for (EngineCase c : page) {
                after = Math.max(after, c.id());
                deadline(c, sla, now).ifPresent(at -> out.put(c.id(), at));
            }
        } while (page.size() == SLA_PAGE);
    }

    /** When an operator had to take the case by; empty when it has no SLA, is excluded or is not due yet. */
    private static Optional<OffsetDateTime> deadline(EngineCase c, Map<Integer, Integer> sla, OffsetDateTime now) {
        Integer minutes = sla.get(c.icu());
        if (minutes == null || c.excluded() || c.firstSignalAt() == null) {
            return Optional.empty();
        }
        OffsetDateTime at = c.firstSignalAt().plusMinutes(minutes);
        return at.isAfter(now) ? Optional.empty() : Optional.of(at);
    }

    private static boolean takenInTime(OffsetDateTime takenAt, OffsetDateTime deadline) {
        return takenAt != null && !takenAt.isAfter(deadline);
    }

    private static Map<Integer, Integer> slaByLevel(SymptomVersion current) {
        Map<Integer, Integer> out = new HashMap<>();
        if (current == null || current.spec() == null || current.spec().levels() == null) {
            return out;
        }
        for (SymptomSpec.Level l : current.spec().levels()) {
            if (l.applies() && l.response() != null && l.response().operator() && l.response().slaMinutes() != null
                    && l.response().slaMinutes() > 0) {
                out.put(l.icu(), l.response().slaMinutes());
            }
        }
        return out;
    }

    private static Operators operators(TowerSettings team, Double sla) {
        return new Operators(team.operators(), team.shiftHours(), team.capacityPerShift(), sla);
    }

    private static Changes changes(List<SymptomSummary> all) {
        long drafts = all.stream().filter(SymptomSummary::hasDraft).count();
        LastPublished last = all.stream()
                .filter(s -> s.current() != null && s.current().publishedAt() != null)
                .max(Comparator.comparing(s -> s.current().publishedAt()))
                .map(s -> new LastPublished(s.definition().id(), s.definition().name(), s.current().version(),
                        s.current().publishedAt(), s.current().publishedBy(), s.current().reason()))
                .orElse(null);
        return new Changes(drafts, last);
    }
}

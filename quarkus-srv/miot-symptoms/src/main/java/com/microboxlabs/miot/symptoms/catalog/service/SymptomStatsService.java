package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.DueCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.LevelCount;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.SymptomSummary;
import com.microboxlabs.miot.symptoms.domain.TowerSettings;
import com.microboxlabs.miot.symptoms.service.TowerSettingsService;
import com.microboxlabs.miot.symptoms.store.TreatmentStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.jboss.logging.Logger;

/**
 * The numbers over the catalog: cases per week by level, operator load per
 * shift, last week's SLA and recent changes.
 *
 * <p>Cases are the evaluator's Control Tower cases, counted at their current
 * level. The weekly average covers the last 90 days, or the days since the
 * organization's first case when that is shorter, and never less than a week.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomStatsService {

    public static final int WINDOW_DAYS = 90;
    static final int MIN_WINDOW_DAYS = 7;
    static final int LEVELS = 4;
    static final int TOP = 3;
    /** Cases read per query for last week's SLA. */
    static final int SLA_PAGE = 2000;

    private static final Logger LOG = Logger.getLogger(SymptomStatsService.class);

    private final SymptomCatalogService catalog;
    private final EngineCaseStore cases;
    private final TreatmentStore treatments;
    private final TowerSettingsService settings;
    private final Supplier<OffsetDateTime> clock;

    /** {@code windowDays} is how many days the weekly averages cover. */
    public record SymptomStats(boolean engineAvailable, int windowDays, List<PerSymptom> symptoms, Totals totals,
            Operators operators, Changes changes) {
    }

    /** One definition's weekly averages; {@code operatorWeek} counts levels that need an operator. */
    public record PerSymptom(UUID definitionId, List<Long> weekByLevel, long week, long operatorWeek) {
    }

    /**
     * Weekly averages over every case. {@code perShift} counts only ACTIVE symptoms at levels that need an
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
    public SymptomStatsService(SymptomCatalogService catalog, EngineCaseStore cases, TreatmentStore treatments,
            TowerSettingsService settings) {
        this(catalog, cases, treatments, settings, () -> OffsetDateTime.now(ZoneOffset.UTC));
    }

    SymptomStatsService(SymptomCatalogService catalog, EngineCaseStore cases, TreatmentStore treatments,
            TowerSettingsService settings, Supplier<OffsetDateTime> clock) {
        this.catalog = catalog;
        this.cases = cases;
        this.treatments = treatments;
        this.settings = settings;
        this.clock = clock;
    }

    public SymptomStats stats(String tenantCode) {
        List<SymptomSummary> all = catalog.list(tenantCode);
        TowerSettings team = settings.get(tenantCode);
        Changes changes = changes(all);
        Instant now = clock.get().toInstant();
        Instant from = now.minus(Duration.ofDays(WINDOW_DAYS));
        List<LevelCount> counts;
        int days;
        try {
            counts = cases.openedCounts(tenantCode, from, now);
            days = windowDays(cases.firstOpening(tenantCode).orElse(now), from, now);
        } catch (RuntimeException e) {
            LOG.warnf(e, "Case counts not available for tenant=%s", tenantCode);
            return new SymptomStats(false, WINDOW_DAYS, List.of(), new Totals(zeros(), 0, 0, null),
                    operators(team, null), changes);
        }

        long[] totalRaw = new long[LEVELS];
        Map<UUID, long[]> raw = new HashMap<>();
        for (LevelCount c : counts) {
            if (c.level() < 1 || c.level() > LEVELS) {
                continue;
            }
            totalRaw[c.level() - 1] += c.count();
            raw.computeIfAbsent(c.definitionId(), id -> new long[LEVELS])[c.level() - 1] += c.count();
        }

        List<PerSymptom> perSymptom = new ArrayList<>();
        long operatorWeekActive = 0;
        for (SymptomSummary s : all) {
            long[] levels = raw.get(s.definition().id());
            if (levels == null) {
                continue;
            }
            List<Long> week = weekly(levels, days);
            long operatorWeek = operatorLevels(s.current()).stream().mapToLong(icu -> week.get(icu - 1)).sum();
            if (s.definition().state() == SymptomState.ACTIVE) {
                operatorWeekActive += operatorWeek;
            }
            perSymptom.add(new PerSymptom(s.definition().id(), week, sum(week), operatorWeek));
        }

        List<Long> totalWeek = weekly(totalRaw, days);
        long total = sum(totalWeek);
        Totals totals = new Totals(totalWeek, total, Math.round(operatorWeekActive / team.shiftsPerWeek()),
                topShare(all, raw, Arrays.stream(totalRaw).sum()));
        Set<UUID> active = all.stream().filter(s -> s.definition().state() == SymptomState.ACTIVE)
                .map(s -> s.definition().id()).collect(Collectors.toSet());
        Double sla = slaMetLastWeek(tenantCode, active, now);
        return new SymptomStats(true, days, perSymptom, totals, operators(team, sla), changes);
    }

    /** Days since the first case, from {@link #MIN_WINDOW_DAYS} up to {@link #WINDOW_DAYS}. */
    static int windowDays(Instant firstCase, Instant from, Instant now) {
        Instant start = firstCase.isAfter(from) ? firstCase : from;
        long days = Duration.between(start, now).plusDays(1).minusNanos(1).toDays();
        return (int) Math.clamp(days, MIN_WINDOW_DAYS, WINDOW_DAYS);
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

    private static List<Long> weekly(long[] windowCounts, int days) {
        return Arrays.stream(windowCounts).map(n -> Math.round(n * 7.0 / days)).boxed().toList();
    }

    private static List<Long> zeros() {
        return List.of(0L, 0L, 0L, 0L);
    }

    private static long sum(List<Long> values) {
        return values.stream().mapToLong(Long::longValue).sum();
    }

    /** The busiest definitions by case count, not by the rounded weekly averages. */
    private static TopShare topShare(List<SymptomSummary> all, Map<UUID, long[]> raw, long total) {
        if (total <= 0) {
            return null;
        }
        List<Map.Entry<UUID, Long>> top = all.stream()
                .map(s -> s.definition().id())
                .filter(raw::containsKey)
                .map(id -> Map.entry(id, Arrays.stream(raw.get(id)).sum()))
                .filter(e -> e.getValue() > 0)
                .sorted(Map.Entry.<UUID, Long>comparingByValue().reversed())
                .limit(TOP)
                .toList();
        if (top.isEmpty()) {
            return null;
        }
        long busiest = top.stream().mapToLong(Map.Entry::getValue).sum();
        return new TopShare(top.stream().map(Map.Entry::getKey).toList(), Math.min(1.0, (double) busiest / total));
    }

    /**
     * Share of last week's cases of ACTIVE symptoms, at levels with an SLA, that an operator took within it. The
     * SLA runs from when the case reached its level. Cases whose SLA has not run out yet are left out.
     */
    private Double slaMetLastWeek(String tenantCode, Set<UUID> active, Instant now) {
        Map<Long, Instant> deadlines = new HashMap<>();
        try {
            long after = 0;
            List<DueCase> page;
            do {
                page = cases.openedPage(tenantCode, now.minus(Duration.ofDays(7)), now, after, SLA_PAGE);
                for (DueCase c : page) {
                    after = Math.max(after, c.id());
                    if (active.contains(c.definitionId()) && c.slaMinutes() != null) {
                        Instant at = c.levelSince().plus(Duration.ofMinutes(c.slaMinutes()));
                        if (!at.isAfter(now)) {
                            deadlines.put(c.symptomId(), at);
                        }
                    }
                }
            } while (page.size() == SLA_PAGE);
        } catch (RuntimeException e) {
            LOG.warnf(e, "Cases not available for the SLA of tenant=%s", tenantCode);
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

    private static boolean takenInTime(OffsetDateTime takenAt, Instant deadline) {
        return takenAt != null && !takenAt.toInstant().isAfter(deadline);
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

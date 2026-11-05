package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.CellDay;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.SenderDay;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The shadow map built from the day rows of the window ({@link CoverageDay}). Each day weighs
 * 0.5^(age / half-life); a sender's anomalous days are left out. A cell's share is
 * {@code (delayed + missing) / (frames + missing)}.
 * <ul>
 * <li>A sender with at least {@code minFrames} in the cell decides alone: shadow when its share is at least
 * max({@code minShare}, {@code overSender} x its share everywhere).</li>
 * <li>Otherwise the cell is shadow when at least {@code consensus} other senders, each deciding alone, see it so.</li>
 * </ul>
 */
public final class ShadowMap {

    /** Who decided a cell. */
    public enum Source {
        SENDER, CONSENSUS, NONE;

        public String value() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    /**
     * What the map says about a sender in a cell.
     *
     * @param share null when nobody decided ({@link Source#NONE}); for a consensus, the pooled share of the other
     *              senders that decide alone
     */
    public record Level(boolean shadow, Double share, Source source) {

        public static final Level NONE = new Level(false, null, Source.NONE);
    }

    private record Weighted(double frames, double delayed, double missing) {

        Weighted plus(CellDay d, double w) {
            return new Weighted(frames + w * d.frames(), delayed + w * d.delayed(), missing + w * d.missing());
        }

        Weighted plus(Weighted o) {
            return new Weighted(frames + o.frames, delayed + o.delayed, missing + o.missing);
        }

        double share() {
            double seen = frames + missing;
            return seen <= 0 ? 0 : (delayed + missing) / seen;
        }
    }

    /** A sender that decides a cell alone. */
    private record Decided(Weighted counts, boolean shadow) {
    }

    private static final ShadowMap EMPTY = new ShadowMap(Map.of(), 2);

    private final Map<String, Map<String, Decided>> byCell;
    private final int consensus;

    private ShadowMap(Map<String, Map<String, Decided>> byCell, int consensus) {
        this.byCell = byCell;
        this.consensus = consensus;
    }

    public static ShadowMap empty() {
        return EMPTY;
    }

    /** How many cells some sender decides alone. */
    public int cells() {
        return byCell.size();
    }

    /** @param cell null without a position */
    public Level level(String sender, String cell) {
        Map<String, Decided> senders = cell == null ? null : byCell.get(cell);
        if (senders == null) {
            return Level.NONE;
        }
        Decided own = sender == null ? null : senders.get(sender);
        if (own != null) {
            return new Level(own.shadow(), round(own.counts().share()), Source.SENDER);
        }
        int shadow = 0;
        Weighted pooled = new Weighted(0, 0, 0);
        int others = 0;
        for (Map.Entry<String, Decided> e : senders.entrySet()) {
            if (e.getKey().equals(sender)) {
                continue;
            }
            others++;
            pooled = pooled.plus(e.getValue().counts());
            if (e.getValue().shadow()) {
                shadow++;
            }
        }
        if (others < consensus) {
            return Level.NONE;
        }
        return new Level(shadow >= consensus, round(pooled.share()), Source.CONSENSUS);
    }

    /**
     * What the cell rows are summed with: the weight of each day of the window and the sender-days left out.
     *
     * @param senders   the window's sender-day rows, {@code anomalous} recomputed ({@link #anomalous})
     * @param weights   the weight of each day of the window
     * @param minFrames cell sums with fewer weighted frames decide nothing, so they need not be read
     */
    public record Plan(List<SenderDay> senders, Map<LocalDate, Double> weights, double minFrames) {

        /** The anomalous sender-days. */
        public List<SenderDay> dropped() {
            return senders.stream().filter(SenderDay::anomalous).toList();
        }
    }

    /** A sender's weighted counts in a cell over the window. */
    public record CellSum(String sender, String cell, double frames, double delayed, double missing) {
    }

    /** The plan as of {@code today}: days from {@code today - window} to yesterday count. */
    public static Plan plan(Collection<SenderDay> senders, LocalDate today, CoverageSettings s) {
        Map<LocalDate, Double> weights = new HashMap<>();
        for (int age = 1; age <= s.window(); age++) {
            LocalDate day = today.minusDays(age);
            weights.put(day, weight(day, today, s));
        }
        return new Plan(anomalous(senders, today, s), weights, s.minFrames());
    }

    /**
     * Sums the cell rows by sender and cell as {@code plan} says, keeping the sums with at least
     * {@link Plan#minFrames} weighted frames. A store does the same in its database.
     */
    public static List<CellSum> sum(Collection<CellDay> cells, Plan plan) {
        Set<String> dropped = new HashSet<>();
        plan.dropped().forEach(d -> dropped.add(dayKey(d.sender(), d.day())));
        Map<String, Map<String, Weighted>> counts = new HashMap<>();
        for (CellDay d : cells) {
            Double w = plan.weights().get(d.day());
            if (w == null || dropped.contains(dayKey(d.sender(), d.day()))) {
                continue;
            }
            counts.computeIfAbsent(d.cell(), k -> new HashMap<>())
                    .merge(d.sender(), new Weighted(0, 0, 0).plus(d, w), Weighted::plus);
        }
        List<CellSum> out = new ArrayList<>();
        counts.forEach((cell, bySender) -> bySender.forEach((sender, c) -> {
            if (c.frames() >= plan.minFrames()) {
                out.add(new CellSum(sender, cell, c.frames(), c.delayed(), c.missing()));
            }
        }));
        return out;
    }

    /** Builds the map as of {@code today} from the day rows; see {@link #of}. */
    public static ShadowMap build(Collection<CellDay> cells, Collection<SenderDay> senders, LocalDate today,
            CoverageSettings s) {
        Plan plan = plan(senders, today, s);
        return of(plan, sum(cells, plan), s);
    }

    /** Builds the map from the plan's sender-days and the cell sums made with it. */
    public static ShadowMap of(Plan plan, Collection<CellSum> sums, CoverageSettings s) {
        Map<String, Weighted> everywhere = new HashMap<>();
        for (SenderDay d : plan.senders()) {
            Double w = plan.weights().get(d.day());
            if (!d.anomalous() && w != null) {
                everywhere.merge(d.sender(), new Weighted(w * d.frames(), w * d.delayed(), w * d.missing()),
                        Weighted::plus);
            }
        }
        Map<String, Map<String, Decided>> byCell = new HashMap<>();
        for (CellSum c : sums) {
            if (c.frames() < s.minFrames()) {
                continue;
            }
            Weighted counts = new Weighted(c.frames(), c.delayed(), c.missing());
            Weighted all = everywhere.get(c.sender());
            double senderShare = all == null ? 0 : all.share();
            boolean shadow = counts.share() >= Math.max(s.minShare(), s.overSender() * senderShare);
            byCell.computeIfAbsent(c.cell(), k -> new HashMap<>()).put(c.sender(), new Decided(counts, shadow));
        }
        return new ShadowMap(byCell, s.consensus());
    }

    /**
     * The sender-days with {@code anomalous} set: a day whose share is at least {@code anomalyShare} and above
     * {@code anomalyFactor} x the sender's median daily share over the window. Days outside the window keep false.
     */
    public static List<SenderDay> anomalous(Collection<SenderDay> senders, LocalDate today, CoverageSettings s) {
        Map<String, List<Double>> shares = new HashMap<>();
        for (SenderDay d : senders) {
            if (weight(d.day(), today, s) != null) {
                shares.computeIfAbsent(d.sender(), k -> new ArrayList<>()).add(d.share());
            }
        }
        Map<String, Double> median = new HashMap<>();
        shares.forEach((sender, list) -> median.put(sender, median(list)));
        List<SenderDay> out = new ArrayList<>(senders.size());
        for (SenderDay d : senders) {
            Double m = median.get(d.sender());
            boolean flag = m != null && weight(d.day(), today, s) != null
                    && d.share() >= s.anomalyShare() && d.share() > s.anomalyFactor() * m;
            out.add(d.anomalous(flag));
        }
        return out;
    }

    /** A day's weight, or null outside the window. Yesterday is 1 day old. */
    static Double weight(LocalDate day, LocalDate today, CoverageSettings s) {
        long age = ChronoUnit.DAYS.between(day, today);
        if (age < 1 || age > s.window()) {
            return null;
        }
        return Math.pow(0.5, age * 86_400_000.0 / s.halfLife().toMillis());
    }

    private static double median(List<Double> values) {
        List<Double> sorted = new ArrayList<>(values);
        sorted.sort(null);
        int n = sorted.size();
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2;
    }

    private static String dayKey(String sender, LocalDate day) {
        return sender + "\u0000" + day;
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}

package com.microboxlabs.miot.fleet.directory;

import com.microboxlabs.miot.fleet.directory.Views.AssetRow;
import com.microboxlabs.miot.fleet.directory.Views.Facet;
import com.microboxlabs.miot.fleet.directory.Views.Indicators;
import com.microboxlabs.miot.fleet.directory.Views.Summary;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

/** Counts, filters and indicators over the fleet list. */
final class AssetFigures {

    /** Days the indicators cover. */
    static final int PERIOD_DAYS = 30;

    private AssetFigures() {
    }

    static Summary summary(List<AssetRow> rows, Map<String, Profile> stored, LocalDate today, Instant endOfToday) {
        int withSignal = 0;
        int inTrip = 0;
        int plannedToday = 0;
        int documentsDue = 0;
        int suggestions = 0;
        for (AssetRow r : rows) {
            if (r.status() != AssetStatus.NO_SIGNAL) {
                withSignal++;
            }
            if (r.status() == AssetStatus.IN_TRIP) {
                inTrip++;
            }
            if (startsBefore(r.nextTrip(), endOfToday)) {
                plannedToday++;
            }
            if (AssetFields.due(stored.get(r.id()), today)) {
                documentsDue++;
            }
            if (r.suggestions() > 0) {
                suggestions++;
            }
        }
        return new Summary(rows.size(), withSignal, inTrip, plannedToday, rows.size() - withSignal, documentsDue,
                suggestions);
    }

    static List<Facet> kinds(List<AssetRow> rows) {
        Map<String, Integer> counts = new TreeMap<>();
        rows.forEach(r -> counts.merge(r.kind().name(), 1, Integer::sum));
        return facets(counts);
    }

    static List<Facet> carriers(List<AssetRow> rows) {
        Map<String, Integer> counts = new TreeMap<>();
        rows.stream().filter(r -> r.carrier() != null).forEach(r -> counts.merge(r.carrier(), 1, Integer::sum));
        return facets(counts);
    }

    private static List<Facet> facets(Map<String, Integer> counts) {
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .map(e -> new Facet(e.getKey(), e.getValue())).toList();
    }

    static boolean matches(AssetRow r, AssetQuery q, Profile profile, LocalDate today) {
        if (q.kind() != null && r.kind() != q.kind()) {
            return false;
        }
        if (q.status() != null && r.status() != q.status()) {
            return false;
        }
        if (q.carrier() != null && !q.carrier().equalsIgnoreCase(Objects.toString(r.carrier(), ""))) {
            return false;
        }
        if (q.withSuggestions() && r.suggestions() == 0) {
            return false;
        }
        if (q.documentsDue() && !AssetFields.due(profile, today)) {
            return false;
        }
        if (q.q() == null || q.q().isBlank()) {
            return true;
        }
        String needle = q.q().trim().toLowerCase(Locale.ROOT);
        return contains(r.id(), needle) || contains(r.label(), needle) || contains(r.driver(), needle)
                || contains(r.carrier(), needle);
    }

    static Comparator<AssetRow> order(String sort) {
        if ("signal".equals(sort)) {
            return Comparator.comparing(AssetRow::lastSignalAt, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(AssetRow::id);
        }
        if ("km".equals(sort)) {
            return Comparator.comparingDouble(AssetRow::km30d).reversed().thenComparing(AssetRow::id);
        }
        return Comparator.comparing(AssetRow::id);
    }

    /**
     * Indicators over {@code PERIOD_DAYS}. {@code totals} is null when the asset has no activity in the period;
     * {@code fleetUtilization} is null when no asset has.
     */
    static Indicators indicators(AssetFacts facts, ActivityTotals totals, Double fleetUtilization) {
        ActivityTotals t = totals == null ? ActivityTotals.NONE : totals;
        return new Indicators(round(t.km()), round(t.engineSeconds() / 3600.0),
                t.engineSeconds() == 0 ? null : round(100.0 * t.idleSeconds() / t.engineSeconds()),
                totals == null ? null : round(100.0 * t.activeDays() / PERIOD_DAYS),
                fleetUtilization == null ? null : round(fleetUtilization), facts.trips30d(),
                facts.trips30d() == 0 ? null : round(facts.tripHours30d() / facts.trips30d()));
    }

    private static boolean startsBefore(TripView trip, Instant end) {
        return trip != null && trip.start() != null && trip.start().isBefore(end);
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    static double round(double value) {
        return Math.round(value * 10) / 10.0;
    }
}

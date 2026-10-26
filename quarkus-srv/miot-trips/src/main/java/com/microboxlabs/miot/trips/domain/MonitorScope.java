package com.microboxlabs.miot.trips.domain;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;

/**
 * The trips a monitor takes. Each dimension lists the values it accepts; an empty list accepts any. A trip is in
 * scope when every dimension accepts it. Locations are location ids.
 *
 * <p>Two scopes of a tenant may be disjoint or one may contain the other; a trip in both goes to the narrower one.
 * Equal or partly overlapping scopes are duplicates, so every trip has at most one narrowest monitor.
 */
public record MonitorScope(List<String> feeds, List<String> orderTypes, List<String> origins,
        List<String> destinations) {

    public static final MonitorScope ANY = new MonitorScope(List.of(), List.of(), List.of(), List.of());

    public MonitorScope {
        feeds = sorted(feeds);
        orderTypes = sorted(orderTypes);
        origins = sorted(origins);
        destinations = sorted(destinations);
    }

    /** What a new trip is matched on; a null value is accepted only by a dimension that accepts any. */
    public record Trip(String feed, String orderType, String origin, String destination) {
    }

    /** How this scope stands to another one of the same tenant. */
    public enum Relation {
        /** No trip is in both. */
        DISJOINT,
        /** This scope is inside the other: its trips go to this monitor. */
        NARROWER,
        /** The other scope is inside this one: its trips go to the other monitor. */
        BROADER,
        /** Same scope, or partly overlapping: some trip would be in both with no narrower one. */
        DUPLICATE
    }

    public boolean accepts(Trip t) {
        return accepts(feeds, t.feed()) && accepts(orderTypes, t.orderType()) && accepts(origins, t.origin())
                && accepts(destinations, t.destination());
    }

    public Relation relationTo(MonitorScope other) {
        List<List<String>> mine = dimensions();
        List<List<String>> theirs = other.dimensions();
        boolean inside = true;
        boolean contains = true;
        for (int i = 0; i < mine.size(); i++) {
            List<String> a = mine.get(i);
            List<String> b = theirs.get(i);
            if (!a.isEmpty() && !b.isEmpty() && a.stream().noneMatch(b::contains)) {
                return Relation.DISJOINT;
            }
            inside &= subset(a, b);
            contains &= subset(b, a);
        }
        if (inside && !contains) {
            return Relation.NARROWER;
        }
        if (contains && !inside) {
            return Relation.BROADER;
        }
        return Relation.DUPLICATE;
    }

    /** The narrowest scope that accepts the trip, or empty when none does or two tie. */
    public static <T> Optional<T> narrowest(Collection<T> candidates, Function<T, MonitorScope> scope,
            Trip trip) {
        List<T> accepting = candidates.stream().filter(c -> scope.apply(c).accepts(trip)).toList();
        List<T> narrowest = new ArrayList<>();
        for (T c : accepting) {
            boolean inAll = accepting.stream().allMatch(o -> o == c
                    || scope.apply(c).relationTo(scope.apply(o)) == Relation.NARROWER);
            if (inAll) {
                narrowest.add(c);
            }
        }
        return narrowest.size() == 1 ? Optional.of(narrowest.get(0)) : Optional.empty();
    }

    private List<List<String>> dimensions() {
        return List.of(feeds, orderTypes, origins, destinations);
    }

    /** Whether every value {@code a} accepts, {@code b} accepts too. */
    private static boolean subset(List<String> candidate, List<String> container) {
        if (container.isEmpty()) {
            return true;
        }
        return !candidate.isEmpty() && container.containsAll(candidate);
    }

    private static boolean accepts(List<String> values, String value) {
        return values.isEmpty() || (value != null && values.contains(value));
    }

    private static List<String> sorted(List<String> values) {
        if (values == null) {
            return List.of();
        }
        Set<String> set = new TreeSet<>();
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                set.add(v.trim());
            }
        }
        return List.copyOf(set);
    }
}

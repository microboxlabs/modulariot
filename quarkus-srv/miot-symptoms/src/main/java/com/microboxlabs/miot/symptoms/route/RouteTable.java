package com.microboxlabs.miot.symptoms.route;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Immutable partition of {@code rule_id} → at most one {@link SymptomRoute}.
 *
 * <p>Matching equals today's 16-pod filter:
 * dedicated {@code targetIds} first, then a single optional catch-all {@code *}.
 * Never two routes for one message.
 */
public final class RouteTable {

    private final List<SymptomRoute> dedicated;
    private final SymptomRoute catchAll;

    private RouteTable(List<SymptomRoute> dedicated, SymptomRoute catchAll) {
        this.dedicated = List.copyOf(dedicated);
        this.catchAll = catchAll;
    }

    public static RouteTable of(List<SymptomRoute> routes) {
        List<SymptomRoute> dedicated = new ArrayList<>();
        SymptomRoute catchAll = null;
        Set<String> claimed = new HashSet<>();

        for (SymptomRoute route : routes) {
            if (route.isCatchAll()) {
                if (catchAll != null) {
                    throw new IllegalArgumentException(
                            "at most one catch-all route allowed; found "
                                    + catchAll.name()
                                    + " and "
                                    + route.name());
                }
                catchAll = route;
                continue;
            }
            for (String id : route.targetIds()) {
                if ("*".equals(id)) {
                    continue;
                }
                if (!claimed.add(id)) {
                    throw new IllegalArgumentException(
                            "overlapping dedicated targetId " + id + " on route " + route.name());
                }
            }
            dedicated.add(route);
        }

        if (catchAll != null) {
            Set<String> missing = new LinkedHashSet<>(claimed);
            missing.removeAll(catchAll.excludeIds());
            if (!missing.isEmpty()) {
                throw new IllegalArgumentException(
                        "catch-all "
                                + catchAll.name()
                                + " excludeIds must cover dedicated targetIds; missing "
                                + missing);
            }
        }

        return new RouteTable(dedicated, catchAll);
    }

    public static RouteTable empty() {
        return new RouteTable(List.of(), null);
    }

    public boolean isEmpty() {
        return dedicated.isEmpty() && catchAll == null;
    }

    public List<SymptomRoute> routes() {
        List<SymptomRoute> all = new ArrayList<>(dedicated);
        if (catchAll != null) {
            all.add(catchAll);
        }
        return List.copyOf(all);
    }

    public Optional<SymptomRoute> catchAll() {
        return Optional.ofNullable(catchAll);
    }

    /**
     * @return the unique owner of {@code ruleId}, or empty to skip (same as
     *     today's "not in target list").
     */
    public Optional<SymptomRoute> match(int ruleId) {
        for (SymptomRoute route : dedicated) {
            if (route.accepts(ruleId)) {
                return Optional.of(route);
            }
        }
        if (catchAll != null && catchAll.accepts(ruleId)) {
            return Optional.of(catchAll);
        }
        return Optional.empty();
    }

    public boolean anyPostgres() {
        return routes().stream().anyMatch(SymptomRoute::hasPostgres);
    }
}

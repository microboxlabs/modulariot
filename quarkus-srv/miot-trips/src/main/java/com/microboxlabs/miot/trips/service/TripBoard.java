package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.trips.domain.BoardRow;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The board's views and lanes. A trip's lane comes from the stage that runs (or closed last) and from its milestones,
 * never from the tenant's service status. A milestone is to confirm when a detection waits for a person, or when the
 * monitor raised its overdue alert and the planned time is still past.
 */
public final class TripBoard {

    public static final String PLANNING = "planning";
    public static final String DISPATCH = "dispatch";
    public static final String DELIVERY = "delivery";
    public static final String FINISHED = "finished";

    public static final String UNASSIGNED = "unassigned";
    public static final String SCHEDULED = "scheduled";
    public static final String DEPARTURE_PENDING = "departure_pending";
    public static final String IN_TRANSIT = "in_transit";
    public static final String ARRIVAL_PENDING = "arrival_pending";
    public static final String UNLOADING = "unloading";
    public static final String CLOSURE_PENDING = "closure_pending";
    public static final String COMPLETED = "completed";
    public static final String REGULARIZED = "regularized";
    public static final String CANCELLED = "cancelled";

    public static final Map<String, List<String>> LANES = Map.of(
            PLANNING, List.of(UNASSIGNED, SCHEDULED, DEPARTURE_PENDING),
            DISPATCH, List.of(IN_TRANSIT, ARRIVAL_PENDING),
            DELIVERY, List.of(UNLOADING, CLOSURE_PENDING),
            FINISHED, List.of(COMPLETED, REGULARIZED, CANCELLED));

    private static final Set<String> BEFORE_DEPARTURE = Set.of("preparation", "loading");
    private static final Set<String> EN_ROUTE = Set.of("transit", "stop");

    private TripBoard() {
    }

    public static List<String> lanes(String view) {
        List<String> lanes = LANES.get(view);
        if (lanes == null) {
            throw new IllegalArgumentException("view must be one of " + String.join(", ", List.of(PLANNING,
                    DISPATCH, DELIVERY, FINISHED)));
        }
        return lanes;
    }

    public static String lane(BoardRow row, OffsetDateTime now) {
        if (Trip.CANCELLED.equals(row.status())) {
            return CANCELLED;
        }
        if (Trip.DONE.equals(row.status())) {
            return row.regularized() ? REGULARIZED : COMPLETED;
        }
        return switch (phase(row)) {
            case PLANNING -> {
                if (toConfirm(row, TripMilestone.DEPARTURE, "departure_overdue", row.plannedStart(), now)) {
                    yield DEPARTURE_PENDING;
                }
                yield row.truck() == null || row.driver() == null ? UNASSIGNED : SCHEDULED;
            }
            case DISPATCH -> toConfirm(row, TripMilestone.ARRIVAL, "arrival_overdue", row.plannedArrival(), now)
                    ? ARRIVAL_PENDING : IN_TRANSIT;
            default -> toConfirm(row, TripMilestone.CLOSURE, "closure_overdue", row.plannedArrival(), now)
                    ? CLOSURE_PENDING : UNLOADING;
        };
    }

    /**
     * Before departure, en route or at destination: the running stage, else what the last closed stage leads to. A
     * confirmed departure or arrival moves the trip on even when no stage followed it.
     */
    private static String phase(BoardRow row) {
        int byStage;
        if (row.currentStage() != null) {
            byStage = BEFORE_DEPARTURE.contains(row.currentStage()) ? 0 : EN_ROUTE.contains(row.currentStage()) ? 1 : 2;
        } else if (row.lastStage() != null) {
            byStage = BEFORE_DEPARTURE.contains(row.lastStage()) ? 1 : 2;
        } else {
            byStage = 0;
        }
        int byMilestone = TripMilestone.CONFIRMED.equals(row.milestone(TripMilestone.ARRIVAL)) ? 2
                : TripMilestone.CONFIRMED.equals(row.milestone(TripMilestone.DEPARTURE)) ? 1 : 0;
        return List.of(PLANNING, DISPATCH, DELIVERY).get(Math.max(byStage, byMilestone));
    }

    private static boolean toConfirm(BoardRow row, String milestone, String overdueAlert, OffsetDateTime due,
            OffsetDateTime now) {
        String status = row.milestone(milestone);
        if (TripMilestone.PENDING.equals(status)) {
            return true;
        }
        return !TripMilestone.CONFIRMED.equals(status) && row.alerts().contains(overdueAlert) && due != null
                && due.isBefore(now);
    }
}

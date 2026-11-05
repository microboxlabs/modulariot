package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.trips.domain.BoardRow;
import com.microboxlabs.miot.trips.domain.DeliveryCycle;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The board's views and lanes. A trip's lane comes from the stage that runs (or closed last) and from its milestones,
 * never from the tenant's service status. A milestone is to confirm when a detection waits for a person, or when the
 * monitor raised its overdue alert and the planned time is still past. Before departure a trip moves to dispatch once
 * something reports its presentation or validation, or its departure is to confirm. A confirmed closure ends the
 * monitoring. The delivery view runs alongside: a trip is there once it has a delivery or its closure is confirmed,
 * in the lane of the step every load reached, so a trip may be in dispatch and in delivery at once.
 */
public final class TripBoard {

    public static final String PLANNING = "planning";
    public static final String DISPATCH = "dispatch";
    public static final String DELIVERY = "delivery";
    public static final String FINISHED = "finished";

    public static final String UNASSIGNED = "unassigned";
    public static final String SCHEDULED = "scheduled";
    public static final String PRESENTATION = "presentation";
    public static final String VALIDATION = "validation";
    public static final String DEPARTURE_PENDING = "departure_pending";
    public static final String IN_TRANSIT = "in_transit";
    public static final String ARRIVAL_PENDING = "arrival_pending";
    public static final String CLOSURE_PENDING = "closure_pending";
    public static final String TO_DELIVER = "to_deliver";
    public static final String DELIVERY_PENDING = "delivery_pending";
    public static final String COMPLETED = "completed";
    public static final String REGULARIZED = "regularized";
    public static final String CANCELLED = "cancelled";

    public static final Map<String, List<String>> LANES = Map.of(
            PLANNING, List.of(UNASSIGNED, SCHEDULED),
            DISPATCH, List.of(PRESENTATION, VALIDATION, DEPARTURE_PENDING, IN_TRANSIT, ARRIVAL_PENDING,
                    CLOSURE_PENDING),
            DELIVERY, List.of(TO_DELIVER, DELIVERY_PENDING, DeliveryCycle.DELIVERED, DeliveryCycle.ACCEPTED,
                    DeliveryCycle.SETTLED),
            FINISHED, List.of(COMPLETED, REGULARIZED, CANCELLED));

    private static final Set<String> BEFORE_DEPARTURE = Set.of("preparation", "loading");
    private static final Set<String> EN_ROUTE = Set.of("transit", "stop");

    private TripBoard() {
    }

    public static List<String> lanesForView(String view) {
        List<String> lanes = LANES.get(view);
        if (lanes == null) {
            throw new IllegalArgumentException("view must be one of " + String.join(", ", List.of(PLANNING,
                    DISPATCH, DELIVERY, FINISHED)));
        }
        return lanes;
    }

    /** The trip's lane in {@code view}; null when the trip is not in the delivery view. */
    public static String lane(BoardRow row, String view, OffsetDateTime now) {
        return DELIVERY.equals(view) ? deliveryLane(row) : lane(row, now);
    }

    /**
     * The step every load reached; before that, whether a step waits for a confirmation. Null for a finished trip and
     * for one without deliveries whose closure is not confirmed.
     */
    public static String deliveryLane(BoardRow row) {
        if (Trip.CANCELLED.equals(row.status()) || Trip.DONE.equals(row.status())
                || !row.deliveries().any() && !confirmed(row, TripMilestone.CLOSURE)) {
            return null;
        }
        int level = row.deliveries().level();
        if (level == 0) {
            return row.deliveries().pending() ? DELIVERY_PENDING : TO_DELIVER;
        }
        return DeliveryCycle.ALL_STEPS.get(level - 1);
    }

    public static String lane(BoardRow row, OffsetDateTime now) {
        if (Trip.CANCELLED.equals(row.status())) {
            return CANCELLED;
        }
        if (Trip.DONE.equals(row.status())) {
            return row.regularized() ? REGULARIZED : COMPLETED;
        }
        if (confirmed(row, TripMilestone.CLOSURE)) {
            return TO_DELIVER;
        }
        return switch (phase(row)) {
            case PLANNING -> beforeDeparture(row, now);
            case DISPATCH -> toConfirm(row, TripMilestone.ARRIVAL, "arrival_overdue", row.plannedArrival(), now)
                    ? ARRIVAL_PENDING : IN_TRANSIT;
            default -> CLOSURE_PENDING;
        };
    }

    /** The first step still missing: departure authorization, validation, presentation, else not started. */
    private static String beforeDeparture(BoardRow row, OffsetDateTime now) {
        if (toConfirm(row, TripMilestone.DEPARTURE, "departure_overdue", row.plannedStart(), now)
                || confirmed(row, TripMilestone.VALIDATION)) {
            return DEPARTURE_PENDING;
        }
        if (reported(row, TripMilestone.VALIDATION) || confirmed(row, TripMilestone.PRESENTATION)) {
            return VALIDATION;
        }
        if (toConfirm(row, TripMilestone.PRESENTATION, "presentation_overdue", row.plannedStart(), now)) {
            return PRESENTATION;
        }
        return row.truck() == null || row.driver() == null ? UNASSIGNED : SCHEDULED;
    }

    private static boolean confirmed(BoardRow row, String milestone) {
        return TripMilestone.CONFIRMED.equals(row.milestone(milestone));
    }

    private static boolean reported(BoardRow row, String milestone) {
        return !TripMilestone.OPEN.equals(row.milestone(milestone));
    }

    /**
     * Before departure, en route or at destination: the running stage, else what the last closed stage leads to. A
     * confirmed departure or arrival moves the trip on even when no stage followed it.
     */
    private static String phase(BoardRow row) {
        int byStage = 0;
        if (row.currentStage() != null) {
            if (EN_ROUTE.contains(row.currentStage())) {
                byStage = 1;
            } else if (!BEFORE_DEPARTURE.contains(row.currentStage())) {
                byStage = 2;
            }
        } else if (row.lastStage() != null) {
            if (BEFORE_DEPARTURE.contains(row.lastStage()) || EN_ROUTE.contains(row.lastStage())) {
                byStage = 1;
            } else {
                byStage = 2;
            }
        }
        int byMilestone = 0;
        if (TripMilestone.CONFIRMED.equals(row.milestone(TripMilestone.ARRIVAL))) {
            byMilestone = 2;
        } else if (TripMilestone.CONFIRMED.equals(row.milestone(TripMilestone.DEPARTURE))) {
            byMilestone = 1;
        }
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

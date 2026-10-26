package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * A trip as the board reads it: its state, the stage that runs or last closed, its milestones, the alerts its monitor
 * raised, and what a card shows. {@code departedAt} and {@code arrivedAt} are the confirmed milestones, else the
 * start of the first stage en route and at destination. {@code label} is the tenant's service status. A finished trip
 * has no hot row, so its truck and driver are the resource ids of its last assignments and the card resolves them.
 * {@code deliveries} says how far each load got in its delivery.
 */
public record BoardRow(
        String tripId,
        String status,
        OffsetDateTime plannedStart,
        OffsetDateTime plannedArrival,
        OffsetDateTime departedAt,
        OffsetDateTime arrivedAt,
        OffsetDateTime actualEnd,
        String currentStage,
        String lastStage,
        Map<String, String> milestones,
        Set<String> alerts,
        List<String> codes,
        String label,
        String origin,
        String destination,
        String truck,
        String trailer,
        String driver,
        String secondDriver,
        String carrier,
        String monitorKey,
        boolean regularized,
        String cancelReason,
        OffsetDateTime updatedAt,
        Deliveries deliveries) {

    /**
     * {@code levels}: per load (each mandate, or each delivery of a trip without mandates) the last confirmed step,
     * 1 to 3 for {@code delivered}, {@code accepted}, {@code settled}, 0 for none. {@code any}: the trip has a
     * delivery. {@code pending}: a step waits for a confirmation.
     */
    public record Deliveries(List<Integer> levels, boolean any, boolean pending) {

        public static final Deliveries NONE = new Deliveries(List.of(), false, false);

        public Deliveries {
            levels = levels == null ? List.of() : List.copyOf(levels);
        }

        /** The step every load reached, 0 when one has none. */
        public int level() {
            return levels.stream().mapToInt(Integer::intValue).min().orElse(0);
        }
    }

    public BoardRow {
        milestones = milestones == null ? Map.of() : Map.copyOf(milestones);
        alerts = alerts == null ? Set.of() : Set.copyOf(alerts);
        codes = codes == null ? List.of() : List.copyOf(codes);
        deliveries = deliveries == null ? Deliveries.NONE : deliveries;
    }

    /** A trip without deliveries. */
    @SuppressWarnings("java:S107") // The board's row, as above.
    public BoardRow(String tripId, String status, OffsetDateTime plannedStart, OffsetDateTime plannedArrival,
            OffsetDateTime departedAt, OffsetDateTime arrivedAt, OffsetDateTime actualEnd, String currentStage,
            String lastStage, Map<String, String> milestones, Set<String> alerts, List<String> codes, String label,
            String origin, String destination, String truck, String trailer, String driver, String secondDriver,
            String carrier, String monitorKey, boolean regularized, String cancelReason, OffsetDateTime updatedAt) {
        this(tripId, status, plannedStart, plannedArrival, departedAt, arrivedAt, actualEnd, currentStage, lastStage,
                milestones, alerts, codes, label, origin, destination, truck, trailer, driver, secondDriver, carrier,
                monitorKey, regularized, cancelReason, updatedAt, Deliveries.NONE);
    }

    public String milestone(String milestone) {
        return milestones.getOrDefault(milestone, TripMilestone.OPEN);
    }

    public BoardRow withResources(String truck, String trailer, String driver, String secondDriver, String carrier) {
        return new BoardRow(tripId, status, plannedStart, plannedArrival, departedAt, arrivedAt, actualEnd,
                currentStage, lastStage, milestones, alerts, codes, label, origin, destination, truck, trailer, driver,
                secondDriver, carrier, monitorKey, regularized, cancelReason, updatedAt, deliveries);
    }
}

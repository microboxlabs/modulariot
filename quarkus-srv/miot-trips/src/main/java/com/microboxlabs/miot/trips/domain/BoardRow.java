package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * A trip as the board reads it: its state, the stage that runs or last closed, its milestones, the alerts its monitor
 * raised, and what a card shows. {@code label} is the tenant's service status. A finished trip has no hot row, so its
 * truck and driver are the resource ids of its last assignments and the card resolves them.
 */
public record BoardRow(
        String tripId,
        String status,
        OffsetDateTime plannedStart,
        OffsetDateTime plannedArrival,
        OffsetDateTime actualStart,
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
        OffsetDateTime updatedAt) {

    public BoardRow {
        milestones = milestones == null ? Map.of() : Map.copyOf(milestones);
        alerts = alerts == null ? Set.of() : Set.copyOf(alerts);
        codes = codes == null ? List.of() : List.copyOf(codes);
    }

    public String milestone(String milestone) {
        return milestones.getOrDefault(milestone, TripMilestone.OPEN);
    }

    public BoardRow withResources(String truck, String driver, String carrier) {
        return new BoardRow(tripId, status, plannedStart, plannedArrival, actualStart, actualEnd, currentStage,
                lastStage, milestones, alerts, codes, label, origin, destination, truck, trailer, driver,
                secondDriver, carrier, monitorKey, regularized, cancelReason, updatedAt);
    }
}

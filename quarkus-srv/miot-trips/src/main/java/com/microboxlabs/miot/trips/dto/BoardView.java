package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.BoardRow;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** One board view: its lanes in order, each with its trip count and the first cards. */
public record BoardView(String view, List<Lane> lanes, OffsetDateTime at) {

    public record Lane(String key, int count, List<Card> cards) {
    }

    /** {@code label} is the tenant's service status; {@code lane} is the board's. */
    public record Card(
            String tripId,
            String lane,
            String status,
            String label,
            List<String> codes,
            String origin,
            String destination,
            String truck,
            String trailer,
            String driver,
            String secondDriver,
            String carrier,
            OffsetDateTime plannedStart,
            OffsetDateTime plannedArrival,
            OffsetDateTime actualStart,
            OffsetDateTime actualEnd,
            String currentStage,
            Map<String, String> milestones,
            Set<String> alerts,
            String monitorKey,
            boolean regularized,
            String cancelReason,
            OffsetDateTime updatedAt) {

        public static Card of(BoardRow r, String lane) {
            return new Card(r.tripId(), lane, r.status(), r.label(), r.codes(), r.origin(), r.destination(),
                    r.truck(), r.trailer(), r.driver(), r.secondDriver(), r.carrier(), r.plannedStart(),
                    r.plannedArrival(), r.actualStart(), r.actualEnd(), r.currentStage(), r.milestones(), r.alerts(),
                    r.monitorKey(), r.regularized(), r.cancelReason(), r.updatedAt());
        }
    }
}

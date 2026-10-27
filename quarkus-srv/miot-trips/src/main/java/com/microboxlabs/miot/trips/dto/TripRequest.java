package com.microboxlabs.miot.trips.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Create/patch body for a trip; on create it may carry mandates to link, planned stages and the key of the monitor
 * that moves it (without one, the monitor whose scope takes the trip).
 */
public record TripRequest(
        String originId,
        String destinationId,
        OffsetDateTime plannedStart,
        List<String> mandateIds,
        List<StageRequest> stages,
        String monitor) {

    public TripRequest(String originId, String destinationId, OffsetDateTime plannedStart, List<String> mandateIds,
            List<StageRequest> stages) {
        this(originId, destinationId, plannedStart, mandateIds, stages, null);
    }

    public static TripRequest empty() {
        return new TripRequest(null, null, null, null, null, null);
    }
}

package com.microboxlabs.miot.trips.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Create/patch body for a trip; on create it may carry mandates to link, planned stages and the key of the monitor
 * that moves it (without one, the tenant's selector picks it). A {@code regularized} trip ran without being
 * monitored and is recorded afterwards: it gets no monitor.
 */
public record TripRequest(
        String originId,
        String destinationId,
        OffsetDateTime plannedStart,
        List<String> mandateIds,
        List<StageRequest> stages,
        String monitor,
        Boolean regularized) {

    public TripRequest(String originId, String destinationId, OffsetDateTime plannedStart, List<String> mandateIds,
            List<StageRequest> stages, String monitor) {
        this(originId, destinationId, plannedStart, mandateIds, stages, monitor, null);
    }

    public TripRequest(String originId, String destinationId, OffsetDateTime plannedStart, List<String> mandateIds,
            List<StageRequest> stages) {
        this(originId, destinationId, plannedStart, mandateIds, stages, null, null);
    }

    public static TripRequest empty() {
        return new TripRequest(null, null, null, null, null, null, null);
    }

    public boolean isRegularized() {
        return Boolean.TRUE.equals(regularized);
    }
}

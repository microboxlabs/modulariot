package com.microboxlabs.miot.trips.dto;

import java.time.OffsetDateTime;
import java.util.List;

/** Create/patch body for a trip; on create it may carry mandates to link and planned stages. */
public record TripRequest(
        String originId,
        String destinationId,
        OffsetDateTime plannedStart,
        List<String> mandateIds,
        List<StageRequest> stages) {

    public static TripRequest empty() {
        return new TripRequest(null, null, null, null, null);
    }
}

package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;

/** Create/patch body for a stage; {@code serviceStatus} is the state it projects on the service. */
public record StageRequest(
        String stageType,
        String serviceStatus,
        String locationId,
        OffsetDateTime plannedStart,
        OffsetDateTime plannedEnd,
        JsonNode checklist) {

    public static StageRequest empty() {
        return new StageRequest(null, null, null, null, null, null);
    }
}

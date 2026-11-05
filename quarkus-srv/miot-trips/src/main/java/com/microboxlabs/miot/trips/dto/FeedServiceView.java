package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;

/** The state of one external service of a feed: the latest desired state, what it maps to, the last outcome. */
public record FeedServiceView(
        String externalCode,
        JsonNode desired,
        String mandateId,
        String tripId,
        boolean open,
        String lastAction,
        JsonNode lastResult,
        OffsetDateTime lastReconciledAt) {
}

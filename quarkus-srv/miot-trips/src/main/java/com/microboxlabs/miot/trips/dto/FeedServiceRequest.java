package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * The desired state of one external service, as a feed sends it. Resources are named by their natural keys (plate,
 * document); the trips module resolves them in fleet. {@code source} is the original record (a spreadsheet row),
 * kept for audit and not compared.
 */
public record FeedServiceRequest(
        String orderType,
        String orderRef,
        OffsetDateTime plannedStart,
        OffsetDateTime plannedEnd,
        Resources resources,
        JsonNode source) {

    /** Truck and trailer by plate, drivers by document; the first driver is the main one. */
    public record Resources(String truck, String trailer, List<String> drivers) {
    }

    public Resources resourcesOrEmpty() {
        return resources == null ? new Resources(null, null, List.of()) : resources;
    }
}

package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.databind.JsonNode;

/** Create/patch body for a stage activity. */
public record ActivityRequest(
        String activityType,
        String status,
        String assignee,
        JsonNode evidence) {

    public static ActivityRequest empty() {
        return new ActivityRequest(null, null, null, null);
    }
}

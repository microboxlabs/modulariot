package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.databind.JsonNode;

/** Completes an activity; when it produces an assignment, that comes in the same body. */
public record CompleteActivityRequest(JsonNode evidence, AssignmentRequest assignment) {
}

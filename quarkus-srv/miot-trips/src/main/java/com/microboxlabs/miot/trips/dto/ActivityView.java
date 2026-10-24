package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.trips.domain.StageActivity;
import java.time.OffsetDateTime;

/** A stage activity as the API serves it. */
public record ActivityView(
        String id,
        String stageId,
        int seq,
        String activityType,
        String status,
        String assignee,
        String assignmentId,
        JsonNode evidence,
        OffsetDateTime doneAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static ActivityView of(StageActivity a) {
        return new ActivityView(a.id(), a.stageId(), a.seq(), a.activityType(), a.status(), a.assignee(),
                a.assignmentId(), Jsons.node(a.evidence()), a.doneAt(), a.createdAt(), a.updatedAt());
    }
}

package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/** A unit of work inside a stage; may produce a resource assignment (0..1). */
public record StageActivity(
        String id,
        String tenantCode,
        String stageId,
        int seq,
        String activityType,
        String status,
        String assignee,
        String assignmentId,
        String evidence,
        OffsetDateTime doneAt,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static final String PENDING = "pendiente";
    public static final String RUNNING = "en_curso";
    public static final String DONE = "hecha";
    public static final String NOT_APPLICABLE = "no_aplica";
}

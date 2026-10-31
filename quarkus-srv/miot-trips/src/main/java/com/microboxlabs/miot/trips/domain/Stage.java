package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/** A state of its subject: at most one 'in_progress' per subject (enforced by a partial unique index). */
public record Stage(
        String id,
        String tenantCode,
        String subjectType,
        String subjectId,
        int seq,
        String stageType,
        String serviceStatus,
        String status,
        String locationId,
        OffsetDateTime plannedStart,
        OffsetDateTime plannedEnd,
        OffsetDateTime actualStart,
        OffsetDateTime actualEnd,
        String checklist,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public static final String PENDING = "pending";
    public static final String RUNNING = "in_progress";
    public static final String CLOSED = "completed";

    public static final String STOP = "stop";

    public static final String SUBJECT_TRIP = "trip";
}

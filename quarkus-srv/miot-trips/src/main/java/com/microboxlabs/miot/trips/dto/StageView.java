package com.microboxlabs.miot.trips.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.trips.domain.Stage;
import java.time.OffsetDateTime;

/** A stage as the API serves it. */
public record StageView(
        String id,
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
        JsonNode checklist,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static StageView of(Stage s) {
        return new StageView(s.id(), s.subjectType(), s.subjectId(), s.seq(), s.stageType(), s.serviceStatus(),
                s.status(), s.locationId(), s.plannedStart(), s.plannedEnd(), s.actualStart(), s.actualEnd(),
                Jsons.node(s.checklist()), s.createdAt(), s.updatedAt());
    }
}

package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

/**
 * The rules of one feed of one tenant: the stages every trip is created with, the stage whose planned end is the
 * arrival time, and which resources a new trip needs (truck, trailer, driver; driver means the first one). The monitor
 * of the trips it creates is the one whose scope takes them; a scope can name the feed.
 */
public record FeedProfile(
        String tenantCode,
        String feedKey,
        String name,
        List<StagePlan> stages,
        String arrivalStage,
        Set<String> requiredResources,
        boolean active,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    /** A planned stage: its type and the service status the feed reports for it. */
    public record StagePlan(String stageType, String serviceStatus) {
    }
}

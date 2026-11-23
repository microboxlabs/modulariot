package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

/**
 * The rules of one feed of one tenant: the stages every trip is created with, the stage whose planned end is the
 * arrival time, which resources a new trip needs (truck, trailer, driver; driver means the first one), and whether it
 * registers in fleet the resources fleet does not have yet ({@code registersResources}). The monitor
 * of the trips it creates is the one whose scope takes them; a scope can name the feed. The optional country
 * (ISO 3166-1 alpha-2) locates address and short Plus Code cells when the feed sends no site. With
 * {@code feedCorrections} a later time from the feed replaces a milestone the feed itself confirmed; without it the
 * first confirmation stays and the difference is reported.
 */
public record FeedProfile(
        String tenantCode,
        String feedKey,
        String name,
        String country,
        List<StagePlan> stages,
        String arrivalStage,
        Set<String> requiredResources,
        boolean registersResources,
        boolean active,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy,
        boolean feedCorrections) {

    /** Without feed corrections. */
    @SuppressWarnings("java:S107") // The profile as it was before corrections.
    public FeedProfile(String tenantCode, String feedKey, String name, String country, List<StagePlan> stages,
            String arrivalStage, Set<String> requiredResources, boolean registersResources, boolean active,
            OffsetDateTime createdAt, String createdBy, OffsetDateTime updatedAt, String updatedBy) {
        this(tenantCode, feedKey, name, country, stages, arrivalStage, requiredResources, registersResources, active,
                createdAt, createdBy, updatedAt, updatedBy, false);
    }

    /** A planned stage: its type and the service status the feed reports for it. */
    public record StagePlan(String stageType, String serviceStatus) {
    }
}

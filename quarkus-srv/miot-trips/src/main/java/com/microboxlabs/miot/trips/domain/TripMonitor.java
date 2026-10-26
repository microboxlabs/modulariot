package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * One version of a trip monitor: the rules that move the stages of one class of trip of a tenant, the stage plan a
 * trip gets when it is created without stages, the parameters its rules read as {@code params.*}, and the trips it
 * takes ({@code scope}; null until it is set, and then the monitor takes none).
 */
public record TripMonitor(
        String tenantCode,
        String monitorKey,
        int version,
        String status,
        String name,
        String description,
        List<StagePlan> plan,
        Map<String, Object> params,
        List<Rule> rules,
        MonitorScope scope,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy,
        OffsetDateTime publishedAt,
        String publishedBy) {

    public static final String DRAFT = "draft";
    public static final String PUBLISHED = "published";

    /** A planned stage: its type and the service status reported for it. */
    public record StagePlan(String stageType, String serviceStatus) {
    }

    /**
     * Trigger ({@code on}) + condition ({@code when}, CEL; empty is always) + actions. {@code at} is the CEL time of
     * a {@code timer} rule. Lower {@code priority} is evaluated first.
     */
    public record Rule(String key, String name, String on, String at, String when, List<Action> then,
            int priority, boolean active) {
    }

    /**
     * {@code advance}, {@code start} and {@code close} take a stage type; {@code cancelTrip} a reason;
     * {@code alert} an alert key; {@code invoke} a process name; {@code requestConfirmation} a milestone
     * ({@code departure}, {@code arrival}, {@code closure}); {@code completeTrip} and {@code closeMandates} nothing.
     */
    public record Action(String type, String value) {
    }
}

package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** What a monitor keeps while it runs on a trip. */
public final class MonitorRun {

    private MonitorRun() {
    }

    /** Something that happened to a trip; {@code on} is a rule trigger and {@code kind} narrows it. */
    public record Event(String tenantCode, String tripId, String on, String kind, OffsetDateTime at, String actor,
            Map<String, Object> data) {

        public Event {
            data = data == null ? Map.of() : Map.copyOf(data);
        }
    }

    /** The monitor version a trip follows; {@code epoch} rises on every evaluation. */
    public record State(String tripId, String tenantCode, String monitorKey, int monitorVersion, int epoch,
            OffsetDateTime boundAt, String boundBy) {
    }

    public record Timer(long id, String tenantCode, String tripId, String ruleKey, int monitorVersion,
            OffsetDateTime dueAt, int epoch, OffsetDateTime firedAt) {
    }

    /** What one event did on a trip. */
    public record Transition(long id, String tenantCode, String tripId, String monitorKey, int monitorVersion,
            Map<String, Object> event, int depth, List<String> matched, String ruleKey, String fromStage,
            String toStage, List<Map<String, Object>> actions, String error, OffsetDateTime at,
            OffsetDateTime createdAt) {
    }
}

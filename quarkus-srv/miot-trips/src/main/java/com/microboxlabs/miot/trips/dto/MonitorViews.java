package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.MonitorSelector;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** The JSON of the monitors API. */
public final class MonitorViews {

    private MonitorViews() {
    }

    /**
     * A problem in an expression of a rule; a draft with findings saves but does not publish.
     *
     * @param ruleKey  the rule, or null for the selector
     * @param field    {@code when} or {@code at}
     * @param position zero-based offset in the expression
     */
    public record Finding(String ruleKey, String field, int position, String message) {
    }

    public record Monitor(
            String key,
            int version,
            String status,
            String name,
            String description,
            List<TripMonitor.StagePlan> plan,
            Map<String, Object> params,
            List<TripMonitor.Rule> rules,
            OffsetDateTime updatedAt,
            String updatedBy,
            OffsetDateTime publishedAt,
            String publishedBy,
            List<Finding> findings) {

        public static Monitor of(TripMonitor m, List<Finding> findings) {
            return new Monitor(m.monitorKey(), m.version(), m.status(), m.name(), m.description(), m.plan(),
                    m.params(), m.rules(), m.updatedAt(), m.updatedBy(), m.publishedAt(), m.publishedBy(),
                    findings);
        }
    }

    /** One row of the list: the newest name, the published and draft versions. */
    public record Summary(
            String key,
            String name,
            String description,
            Integer publishedVersion,
            Integer draftVersion,
            int rules,
            OffsetDateTime updatedAt,
            String updatedBy) {
    }

    public record Version(int version, String status, OffsetDateTime publishedAt, String publishedBy,
            OffsetDateTime updatedAt, String updatedBy) {

        public static Version of(TripMonitor m) {
            return new Version(m.version(), m.status(), m.publishedAt(), m.publishedBy(), m.updatedAt(),
                    m.updatedBy());
        }
    }

    /** A monitor with its draft and its newest published version; either may be null, not both. */
    public record Detail(String key, Monitor draft, Monitor published, List<Version> versions) {
    }

    /** What an expression may read: full path to type. */
    public record Field(String path, String type) {
    }

    public record CheckRequest(String on, String expression, String expect, Map<String, Object> params) {
    }

    public record CheckResult(boolean ok, String resultType, List<Finding> findings) {
    }

    public record SelectorRequest(List<Entry> entries) {

        public record Entry(String condition, String monitorKey) {
        }
    }

    public record Selector(List<MonitorSelector> entries) {
    }
}

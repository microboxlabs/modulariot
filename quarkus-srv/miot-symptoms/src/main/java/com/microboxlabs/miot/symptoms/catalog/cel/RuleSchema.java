package com.microboxlabs.miot.symptoms.catalog.cel;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * What a rule may reference: one root object with typed field paths (from a
 * data source), plus loose variables such as {@code measure}.
 *
 * @param root   the root variable, such as {@code signal} or {@code case}
 * @param fields full path (starting with the root) to field type
 * @param extras variable name to field type
 */
public record RuleSchema(String root, Map<String, String> fields, Map<String, String> extras) {

    /** Copies the maps, so a schema used as a cache key cannot change. */
    public RuleSchema {
        fields = Map.copyOf(fields);
        extras = Map.copyOf(extras);
    }

    private static final String NUMBER = "number";

    /** The variables a level condition adds to the source: the measure and how long it has held. */
    public static final Map<String, String> LEVEL_VARIABLES = Map.of("measure", NUMBER, "held_s", NUMBER,
            "open_s", NUMBER);

    /** The case a lifecycle rule reads. */
    public static final RuleSchema CASE = new RuleSchema("case", Map.of(
            "case.condition_s", NUMBER,
            "case.normal_s", NUMBER,
            "case.age_h", NUMBER,
            "case.level", NUMBER,
            "case.closed_by_operator", "bool",
            "case.closed_on_trip", "bool",
            "case.off_trip_s", NUMBER), Map.of());

    public static RuleSchema of(DataSource source) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (SourceField f : source.fields()) {
            fields.put(f.path(), f.type());
        }
        return new RuleSchema(source.root(), fields, Map.of());
    }

    /**
     * What a lifecycle rule reads: the case, and the source's signal that moved it, so a close rule can read a
     * device event ({@code case.closed_by_operator || signal.frame.events.exists(...)}).
     */
    public static RuleSchema lifecycle(DataSource source) {
        if (source == null) {
            return CASE;
        }
        Map<String, String> fields = new LinkedHashMap<>(CASE.fields());
        source.fields().forEach(f -> fields.putIfAbsent(f.path(), f.type()));
        return new RuleSchema(CASE.root(), fields, Map.of());
    }

    public RuleSchema withExtras(Map<String, String> more) {
        Map<String, String> all = new LinkedHashMap<>(extras);
        all.putAll(more);
        return new RuleSchema(root, fields, all);
    }
}

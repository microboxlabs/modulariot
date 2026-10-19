package com.microboxlabs.miot.symptoms.catalog.cel;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * What a rule may reference: one root object with typed field paths (from a
 * data source), plus loose variables such as {@code medida}.
 *
 * @param root   the root variable, such as {@code signal} or {@code caso}
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
    public static final Map<String, String> LEVEL_VARIABLES = Map.of("medida", NUMBER, "sostenido_s", NUMBER);

    /** The case a lifecycle rule reads. */
    public static final RuleSchema CASE = new RuleSchema("caso", Map.of(
            "caso.condicion_s", NUMBER,
            "caso.normal_s", NUMBER,
            "caso.edad_h", NUMBER,
            "caso.nivel", NUMBER,
            "caso.cerrado_por_operador", "bool"), Map.of());

    public static RuleSchema of(DataSource source) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (SourceField f : source.fields()) {
            fields.put(f.path(), f.type());
        }
        return new RuleSchema(source.root(), fields, Map.of());
    }

    public RuleSchema withExtras(Map<String, String> more) {
        Map<String, String> all = new LinkedHashMap<>(extras);
        all.putAll(more);
        return new RuleSchema(root, fields, all);
    }
}

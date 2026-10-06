package com.microboxlabs.miot.symptoms.evaluator;

import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.PreparedRule;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleSchema;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/**
 * One published symptom version with its rules compiled once, ready to run on
 * every signal of its source.
 *
 * @param sourceKey the data source whose signals it reads
 * @param measure   null for a symptom whose levels do not read a measure
 * @param levels  the levels that apply, by ICU, lowest first
 * @param state     TEST runs in shadow, ACTIVE runs live; OFF versions are not compiled
 * @param levelDown an open case's level follows the measure down
 */
public record CompiledSymptom(
        UUID definitionId,
        String version,
        SymptomState state,
        String sourceKey,
        PreparedRule activation,
        PreparedRule measure,
        Map<Integer, PreparedRule> levels,
        PreparedRule open,
        PreparedRule close,
        boolean levelDown) {

    /** The same rules under another state, as when the symptom is switched between test and active. */
    public CompiledSymptom withState(SymptomState next) {
        return new CompiledSymptom(definitionId, version, next, sourceKey, activation, measure, levels, open,
                close, levelDown);
    }

    public static CompiledSymptom compile(UUID definitionId, String version, SymptomState state, SymptomSpec spec,
            DataSource source) {
        if (state == SymptomState.OFF) {
            throw new IllegalArgumentException("an OFF symptom is not evaluated");
        }
        if (spec.lifecycle() == null) {
            throw new IllegalArgumentException("the version has no lifecycle");
        }
        RuleSchema schema = RuleSchema.of(source);
        RuleSchema levelSchema = schema.withExtras(RuleSchema.LEVEL_VARIABLES);
        Map<Integer, PreparedRule> levels = new TreeMap<>();
        for (Level l : spec.levels() == null ? List.<Level>of() : spec.levels()) {
            if (l.applies()) {
                levels.put(l.icu(), RuleLanguage.prepare(levelSchema, l.when()));
            }
        }
        PreparedRule measure = spec.measure() == null || spec.measure().expression() == null ? null
                : RuleLanguage.prepare(schema, spec.measure().expression());
        return new CompiledSymptom(definitionId, version, state, source.key(),
                RuleLanguage.prepare(schema, spec.activation()),
                measure, Collections.unmodifiableMap(levels),
                RuleLanguage.prepare(RuleSchema.CASE, spec.lifecycle().open()),
                RuleLanguage.prepare(RuleSchema.CASE, spec.lifecycle().close()), spec.lifecycle().levelDown());
    }
}

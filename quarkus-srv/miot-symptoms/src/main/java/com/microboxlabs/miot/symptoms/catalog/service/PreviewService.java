package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.PreparedRule;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleResult;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleSchema;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Runs a spec on its source's samples and says, for each one, whether the
 * symptom activates, the measure and the level it reaches.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PreviewService {

    /** Sample key for how long the condition has held, in seconds. */
    static final String HELD = "held_s";

    private final SymptomCatalogService catalog;
    private final DataSourceService sources;

    public PreviewService(SymptomCatalogService catalog, DataSourceService sources) {
        this.catalog = catalog;
        this.sources = sources;
    }

    /**
     * One sample's result.
     *
     * @param level the ICU level reached, or null
     * @param error why the rules could not run on this sample, or null
     */
    public record SamplePreview(Map<String, Object> sample, Boolean activates, Double measure, Integer level,
            String error) {
    }

    public record Preview(String source, List<SamplePreview> samples) {
    }

    /** Previews {@code spec}, or the draft (else the version in force) when it is null. */
    public Preview preview(String tenantCode, UUID id, SymptomSpec spec) {
        SymptomCatalogService.SymptomDetail detail = catalog.get(tenantCode, id);
        SymptomSpec checked = spec != null ? spec : pick(detail);
        String key = checked.source() == null ? detail.definition().sourceKey() : checked.source();
        DataSource source = sources.get(tenantCode, key);
        return new Preview(source.key(), run(checked, source));
    }

    static List<SamplePreview> run(SymptomSpec spec, DataSource source) {
        RuleSchema schema = RuleSchema.of(source);
        RuleSchema levelSchema = schema.withExtras(RuleSchema.LEVEL_VARIABLES);
        PreparedRule activation = RuleLanguage.prepare(schema, spec.activation());
        PreparedRule measure = spec.measure() == null || spec.measure().expression() == null ? null
                : RuleLanguage.prepare(schema, spec.measure().expression());
        Map<Integer, PreparedRule> levels = new LinkedHashMap<>();
        for (Level l : spec.levels() == null ? List.<Level>of() : spec.levels()) {
            if (l.applies()) {
                levels.put(l.icu(), RuleLanguage.prepare(levelSchema, l.when()));
            }
        }
        List<SamplePreview> out = new ArrayList<>();
        for (Map<String, Object> sample : source.samples()) {
            out.add(runOne(sample, activation, measure, levels));
        }
        return out;
    }

    private static SamplePreview runOne(Map<String, Object> sample, PreparedRule activation, PreparedRule measure,
            Map<Integer, PreparedRule> levels) {
        RuleResult active = activation.run(sample);
        if (!active.ok()) {
            return new SamplePreview(sample, null, null, null, active.error());
        }
        Double value = null;
        if (measure != null) {
            RuleResult m = measure.run(sample);
            if (!m.ok()) {
                return new SamplePreview(sample, Boolean.TRUE.equals(active.value()), null, null, m.error());
            }
            value = ((Number) m.value()).doubleValue();
        }
        if (!Boolean.TRUE.equals(active.value())) {
            return new SamplePreview(sample, false, value, null, null);
        }
        Map<String, Object> vars = new LinkedHashMap<>(sample);
        vars.put("medida", value == null ? 0.0 : value);
        vars.put("sostenido_s", sample.get(HELD) instanceof Number n ? n.doubleValue() : 0.0);
        Integer reached = null;
        for (Map.Entry<Integer, PreparedRule> e : levels.entrySet()) {
            if (Boolean.TRUE.equals(e.getValue().run(vars).value())) {
                reached = e.getKey();
            }
        }
        return new SamplePreview(sample, true, value, reached, null);
    }

    private static SymptomSpec pick(SymptomCatalogService.SymptomDetail detail) {
        SymptomVersion v = detail.draft() != null ? detail.draft() : detail.current();
        if (v == null) {
            throw new NoSuchElementException("the symptom has no draft or version to preview");
        }
        return v.spec();
    }
}

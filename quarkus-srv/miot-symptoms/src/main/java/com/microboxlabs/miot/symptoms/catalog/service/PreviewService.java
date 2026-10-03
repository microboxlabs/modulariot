package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.PreparedRule;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleResult;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleSchema;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleText;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
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
    private static final String NOT_A_CONDITION = "La condición debe dar sí o no.";

    private final SymptomCatalogService catalog;
    private final DataSourceService sources;

    public PreviewService(SymptomCatalogService catalog, DataSourceService sources) {
        this.catalog = catalog;
        this.sources = sources;
    }

    /**
     * One sample's result.
     *
     * @param level   the ICU level reached, or null
     * @param error   why the rules could not run on this sample, or null
     * @param clauses each condition of an activation joined by {@code &&}, run on its own; empty otherwise
     */
    public record SamplePreview(Map<String, Object> sample, Boolean activates, Double measure, Integer level,
            String error, List<Clause> clauses) {

        SamplePreview withClauses(List<Clause> next) {
            return new SamplePreview(sample, activates, measure, level, error, next);
        }
    }

    /**
     * One condition of the activation on one sample.
     *
     * @param holds  whether the condition holds, or null when it could not run
     * @param values the sample's value for each field the condition reads
     * @param error  why it could not run, or null
     */
    public record Clause(String text, Boolean holds, Map<String, Object> values, String error) {
    }

    /**
     * The lifecycle on one case moment.
     *
     * @param scenario which moment, a key the app names
     * @param open     whether a case is already open; then the close rule runs, else the open rule
     * @param sample   the {@code caso} object the rule reads
     * @param outcome  {@code opens} or {@code waits} for a case not open yet, {@code closes} or {@code stays_open}
     *                 for an open one; null when the rule could not run
     * @param error    why the rule could not run, or null
     */
    public record CasePreview(String scenario, boolean open, Map<String, Object> sample, String outcome,
            String error) {
    }

    public record Preview(String source, List<SamplePreview> samples, List<CasePreview> cases) {
    }

    /** A fixed case moment: seconds the condition has held, seconds back to normal, hours open, level. */
    record Scenario(String key, boolean open, double conditionS, double normalS, double ageH, int level,
            boolean closedByOperator) {

        Map<String, Object> sample() {
            Map<String, Object> caso = new LinkedHashMap<>();
            caso.put("condicion_s", conditionS);
            caso.put("normal_s", normalS);
            caso.put("edad_h", ageH);
            caso.put("nivel", (double) level);
            caso.put("cerrado_por_operador", closedByOperator);
            return Map.of("caso", caso);
        }
    }

    /** {@code caso.normal_s} while the condition still holds, as the engine writes it. */
    private static final double NOT_NORMAL = -1;

    static final List<Scenario> SCENARIOS = List.of(
            new Scenario("detected", false, 10, NOT_NORMAL, 0, 1, false),
            new Scenario("held", false, 75, NOT_NORMAL, 0, 4, false),
            new Scenario("ongoing", true, 75, NOT_NORMAL, 0.1, 4, false),
            new Scenario("normal", true, 0, 180, 0.5, 3, false),
            new Scenario("closed_by_operator", true, 0, 30, 1, 2, true));

    /** Previews {@code spec}, or the draft (else the version in force) when it is null. */
    public Preview preview(String tenantCode, UUID id, SymptomSpec spec) {
        SymptomCatalogService.SymptomDetail detail = catalog.get(tenantCode, id);
        SymptomSpec checked = spec != null && !spec.isEmpty() ? spec : pick(detail);
        String key = checked.source() == null ? detail.definition().sourceKey() : checked.source();
        DataSource source = sources.get(tenantCode, key);
        return new Preview(source.key(), run(checked, source), cases(checked.lifecycle()));
    }

    static List<SamplePreview> run(SymptomSpec spec, DataSource source) {
        RuleSchema schema = RuleSchema.of(source);
        RuleSchema levelSchema = schema.withExtras(RuleSchema.LEVEL_VARIABLES);
        PreparedRule activation = RuleLanguage.prepare(schema, spec.activation());
        Map<String, PreparedRule> clauses = new LinkedHashMap<>();
        // The text split must agree with the parsed rule: "flag ? a && b : false" is one condition, not two.
        ConditionChecks.conjunction(spec.activation())
                .filter(terms -> terms.size() == RuleText.conjunctionSize(spec.activation()))
                .ifPresent(terms -> terms.forEach(t -> clauses.put(t, RuleLanguage.prepare(schema, t))));
        PreparedRule measure = spec.measure() == null || spec.measure().expression() == null ? null
                : RuleLanguage.prepare(schema, spec.measure().expression());
        Map<Integer, PreparedRule> levels = new LinkedHashMap<>();
        for (Level l : spec.levels() == null ? List.<Level>of() : spec.levels()) {
            if (l.applies()) {
                levels.put(l.icu(), RuleLanguage.prepare(levelSchema, l.when()));
            }
        }
        return source.samples().stream()
                .map(sample -> runOne(sample, activation, measure, levels).withClauses(clauses(sample, clauses)))
                .toList();
    }

    /** The lifecycle on each fixed case moment; none without a lifecycle. */
    static List<CasePreview> cases(SymptomSpec.Lifecycle lifecycle) {
        if (lifecycle == null) {
            return List.of();
        }
        PreparedRule open = RuleLanguage.prepare(RuleSchema.CASE, lifecycle.open());
        PreparedRule close = RuleLanguage.prepare(RuleSchema.CASE, lifecycle.close());
        return SCENARIOS.stream().map(s -> {
            Map<String, Object> sample = s.sample();
            RuleResult r = (s.open() ? close : open).run(sample);
            if (!r.ok()) {
                return new CasePreview(s.key(), s.open(), sample, null, r.error());
            }
            if (!(r.value() instanceof Boolean holds)) {
                return new CasePreview(s.key(), s.open(), sample, null, NOT_A_CONDITION);
            }
            String outcome = s.open() ? (holds ? "closes" : "stays_open") : (holds ? "opens" : "waits");
            return new CasePreview(s.key(), s.open(), sample, outcome, null);
        }).toList();
    }

    private static List<Clause> clauses(Map<String, Object> sample, Map<String, PreparedRule> rules) {
        return rules.entrySet().stream().map(e -> {
            Map<String, Object> values = new LinkedHashMap<>();
            RuleText.fieldPaths(e.getKey()).forEach(path -> values.put(path, valueAt(sample, path)));
            RuleResult r = e.getValue().run(sample);
            if (!r.ok()) {
                return new Clause(e.getKey(), null, values, r.error());
            }
            return r.value() instanceof Boolean b ? new Clause(e.getKey(), b, values, null)
                    : new Clause(e.getKey(), null, values, NOT_A_CONDITION);
        }).toList();
    }

    /** The value at a dotted path of the sample, or null when a part is missing. */
    static Object valueAt(Map<String, Object> sample, String path) {
        Object at = sample;
        for (String part : path.split("\\.")) {
            if (!(at instanceof Map<?, ?> map)) {
                return null;
            }
            at = map.get(part);
        }
        return at;
    }

    private static SamplePreview runOne(Map<String, Object> sample, PreparedRule activation, PreparedRule measure,
            Map<Integer, PreparedRule> levels) {
        RuleResult active = activation.run(sample);
        if (!active.ok()) {
            return failed(sample, null, active.error());
        }
        if (!(active.value() instanceof Boolean condition)) {
            return failed(sample, null, NOT_A_CONDITION);
        }
        boolean activates = condition;
        Double value = null;
        if (measure != null) {
            RuleResult m = measure.run(sample);
            if (!m.ok()) {
                return failed(sample, activates, m.error());
            }
            if (!(m.value() instanceof Number n)) {
                return failed(sample, activates, "La medida debe dar un número.");
            }
            value = n.doubleValue();
        }
        if (!activates) {
            return new SamplePreview(sample, false, value, null, null, List.of());
        }
        return reachLevel(sample, value, levels);
    }

    /** Runs the levels on an active sample; the last one that holds is the level reached. */
    private static SamplePreview reachLevel(Map<String, Object> sample, Double value,
            Map<Integer, PreparedRule> levels) {
        Map<String, Object> vars = new LinkedHashMap<>(sample);
        vars.put("medida", value == null ? 0.0 : value);
        vars.put("sostenido_s", sample.get(HELD) instanceof Number n ? n.doubleValue() : 0.0);
        Integer reached = null;
        for (Map.Entry<Integer, PreparedRule> e : levels.entrySet()) {
            RuleResult r = e.getValue().run(vars);
            if (!r.ok() || !(r.value() instanceof Boolean)) {
                String error = r.ok() ? NOT_A_CONDITION : r.error();
                return new SamplePreview(sample, true, value, null, "Nivel " + e.getKey() + ": " + error, List.of());
            }
            if (Boolean.TRUE.equals(r.value())) {
                reached = e.getKey();
            }
        }
        return new SamplePreview(sample, true, value, reached, null, List.of());
    }

    private static SamplePreview failed(Map<String, Object> sample, Boolean activates, String error) {
        return new SamplePreview(sample, activates, null, null, error, List.of());
    }

    private static SymptomSpec pick(SymptomCatalogService.SymptomDetail detail) {
        SymptomVersion v = detail.draft() != null ? detail.draft() : detail.current();
        if (v == null) {
            throw new NoSuchElementException("the symptom has no draft or version to preview");
        }
        return v.spec();
    }
}

package com.microboxlabs.miot.symptoms.catalog.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleCheck;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.Expect;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.PreparedRule;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleSchema;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleText;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Checks a spec before it is published. Errors block publishing; warnings
 * do not. Rules are checked against the source's schema.
 */
public final class SpecValidator {

    /** Distance from each threshold at which overlaps are tried, on both sides. */
    private static final double NEAR = 0.01;
    private static final String LEVELS = "levels";

    /** Severity of a finding. */
    public enum Severity {
        ERROR,
        WARNING
    }

    /**
     * One finding.
     *
     * @param position character offset in the section's rule, or -1
     */
    public record Finding(String section, Severity severity, String message, int position) {
    }

    /** All findings for one spec. */
    public record Report(List<Finding> findings) {

        public Report {
            findings = findings == null ? List.of() : List.copyOf(findings);
        }

        @JsonProperty
        public boolean publishable() {
            return findings.stream().noneMatch(f -> f.severity() == Severity.ERROR);
        }

        /** Fields the rules use that the engine does not evaluate yet: only "En prueba" is allowed. */
        @JsonProperty
        public boolean needsTestOnly() {
            return findings.stream().anyMatch(f -> "engine".equals(f.section()));
        }
    }

    private SpecValidator() {
    }

    public static Report validate(SymptomSpec spec, DataSource source) {
        List<Finding> out = new ArrayList<>();
        if (source == null) {
            out.add(new Finding("source", Severity.ERROR, "La fuente de datos no existe.", -1));
            return new Report(out);
        }
        RuleSchema schema = RuleSchema.of(source);
        rule(out, "activation", schema, spec.activation(), Expect.CONDITION);
        duplicates(out, spec.activation());
        if (spec.measure() != null && spec.measure().expression() != null) {
            rule(out, "measure", schema, spec.measure().expression(), Expect.NUMBER);
        }
        levels(out, schema.withExtras(RuleSchema.LEVEL_VARIABLES), spec.levels());
        if (spec.lifecycle() == null) {
            out.add(new Finding("lifecycle", Severity.ERROR, "Falta decir cuándo se abre y se cierra el caso.", -1));
        } else {
            rule(out, "lifecycle.open", RuleSchema.CASE, spec.lifecycle().open(), Expect.CONDITION);
            rule(out, "lifecycle.close", RuleSchema.CASE, spec.lifecycle().close(), Expect.CONDITION);
        }
        engineSupport(out, source, spec);
        return new Report(out);
    }

    private static void rule(List<Finding> out, String section, RuleSchema schema, String rule, Expect expect) {
        RuleCheck check = RuleLanguage.check(schema, rule, expect);
        check.issues().forEach(i -> out.add(new Finding(section, Severity.ERROR, i.message(), i.position())));
    }

    private static void levels(List<Finding> out, RuleSchema schema, List<Level> levels) {
        if (levels == null || levels.stream().noneMatch(Level::applies)) {
            out.add(new Finding(LEVELS, Severity.ERROR, "Al menos un nivel debe aplicar.", -1));
            return;
        }
        Set<Integer> seen = new HashSet<>();
        List<Level> valid = new ArrayList<>();
        for (Level level : levels) {
            if (level.icu() < 1 || level.icu() > 4 || !seen.add(level.icu())) {
                out.add(new Finding(LEVELS, Severity.ERROR, "Cada nivel va del 1 al 4 y aparece una vez.", -1));
                return;
            }
            if (!level.applies()) {
                continue;
            }
            String section = "levels." + level.icu();
            int before = out.size();
            rule(out, section, schema, level.when(), Expect.CONDITION);
            response(out, section, level.response());
            if (out.size() == before) {
                valid.add(level);
            }
        }
        overlaps(out, schema, valid);
    }

    private static void response(List<Finding> out, String section, SymptomSpec.Response response) {
        if (response != null && response.operator() && (response.slaMinutes() == null || response.slaMinutes() <= 0)) {
            out.add(new Finding(section, Severity.ERROR, "Si interviene un operador, el nivel necesita un SLA.", -1));
        }
    }

    /**
     * Two levels true for the same measure and hold time. Thresholds are
     * comparisons, so trying each number in the rules, just below and just
     * above it, plus zero and past the largest, finds every overlap.
     */
    private static void overlaps(List<Finding> out, RuleSchema schema, List<Level> levels) {
        Map<Level, PreparedRule> rules = new LinkedHashMap<>();
        levels.forEach(l -> rules.put(l, RuleLanguage.prepare(schema, l.when())));
        List<Double> points = testPoints(levels);
        Set<String> reported = new HashSet<>();
        for (double held : points) {
            for (double measure : points) {
                Map<String, Object> vars = Map.of("medida", measure, "sostenido_s", held);
                List<Level> hits = levels.stream()
                        .filter(l -> Boolean.TRUE.equals(rules.get(l).run(vars).value()))
                        .toList();
                reportOverlaps(out, reported, hits, measure, held);
            }
        }
    }

    static List<Double> testPoints(List<Level> levels) {
        TreeSet<Double> points = new TreeSet<>();
        points.add(0.0);
        for (Level l : levels) {
            for (double n : RuleText.numbers(l.when())) {
                points.add(n - NEAR);
                points.add(n);
                points.add(n + NEAR);
            }
        }
        points.add(points.last() + 1);
        return List.copyOf(points);
    }

    private static void reportOverlaps(List<Finding> out, Set<String> reported, List<Level> hits, double measure,
            double held) {
        for (int i = 0; i + 1 < hits.size(); i++) {
            String a = SpecDiff.LEVEL_NAMES[hits.get(i).icu() - 1];
            String b = SpecDiff.LEVEL_NAMES[hits.get(i + 1).icu() - 1];
            if (reported.add(a + b)) {
                out.add(new Finding(LEVELS, Severity.ERROR, String.format(
                        "%s y %s se solapan: con medida %s y %s s sostenidos se cumplen los dos.",
                        a, b, number(measure), number(held)), -1));
            }
        }
    }

    /** The same condition twice in the top-level list of an activation rule. */
    private static void duplicates(List<Finding> out, String rule) {
        if (rule == null) {
            return;
        }
        Set<String> seen = new HashSet<>();
        for (String term : topLevelTerms(rule)) {
            if (!seen.add(term)) {
                out.add(new Finding("activation", Severity.ERROR, "La condición «" + term + "» está repetida.",
                        rule.indexOf(term, rule.indexOf(term) + 1)));
            }
        }
    }

    /** Splits on {@code &&} and {@code ||} outside parentheses and strings. */
    static List<String> topLevelTerms(String rule) {
        List<String> terms = new ArrayList<>();
        int depth = 0;
        boolean quoted = false;
        int start = 0;
        int i = 0;
        while (i < rule.length()) {
            char c = rule.charAt(i);
            if (c == '"') {
                quoted = !quoted;
            } else if (!quoted && (c == '(' || c == '[')) {
                depth++;
            } else if (!quoted && (c == ')' || c == ']')) {
                depth--;
            } else if (!quoted && depth == 0 && isLogicalOperator(rule, i)) {
                terms.add(SpecDiff.squash(rule.substring(start, i)));
                start = i + 2;
                i++;
            }
            i++;
        }
        terms.add(SpecDiff.squash(rule.substring(start)));
        return terms;
    }

    private static boolean isLogicalOperator(String rule, int i) {
        return i + 1 < rule.length() && rule.charAt(i) == rule.charAt(i + 1)
                && (rule.charAt(i) == '&' || rule.charAt(i) == '|');
    }

    private static void engineSupport(List<Finding> out, DataSource source, SymptomSpec spec) {
        Set<String> unsupported = source.fields().stream()
                .filter(f -> !f.engineSupported())
                .map(SourceField::path)
                .collect(Collectors.toSet());
        List<String> rules = new ArrayList<>();
        rules.add(spec.activation());
        if (spec.measure() != null) {
            rules.add(spec.measure().expression());
        }
        if (spec.levels() != null) {
            spec.levels().stream().filter(Level::applies).forEach(l -> rules.add(l.when()));
        }
        Set<String> reported = new HashSet<>();
        for (String rule : rules) {
            for (String path : RuleText.fieldPaths(rule)) {
                if (unsupported.contains(path) && reported.add(path)) {
                    out.add(new Finding("engine", Severity.WARNING,
                            "El motor aún no evalúa «" + path + "»: solo se puede publicar En prueba.",
                            rule.indexOf(path)));
                }
            }
        }
    }

    private static String number(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }
}

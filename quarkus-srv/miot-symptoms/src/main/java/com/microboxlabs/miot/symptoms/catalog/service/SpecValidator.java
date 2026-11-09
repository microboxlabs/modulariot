package com.microboxlabs.miot.symptoms.catalog.service;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleCheck;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.Expect;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleMessage;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.PreparedRule;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleSchema;
import com.microboxlabs.miot.symptoms.catalog.cel.RuleText;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Predicate;
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
    private static final String LEVEL_SECTION_PREFIX = "levels.";
    private static final String RESPONSE_SUFFIX = ".response";
    private static final String ACTIVATION = "activation";
    private static final String MEASURE = "measure";
    private static final String HELD = "held_s";
    private static final String OPEN = "open_s";

    /** Severity of a finding. */
    public enum Severity {
        ERROR,
        WARNING
    }

    /**
     * One finding.
     *
     * @param text     the finding as a code the app translates
     * @param position character offset in the section's rule, or -1
     */
    public record Finding(String section, Severity severity, @JsonIgnore RuleMessage text, int position) {

        public Finding {
            text = text == null ? new RuleMessage(null, Map.of()) : text;
        }

        @JsonProperty
        public String code() {
            return text.code();
        }

        @JsonProperty
        public Map<String, String> params() {
            return text.params();
        }

        /** The finding in Spanish, for logs and clients that do not know the code. */
        @JsonProperty
        public String message() {
            return text.spanish();
        }
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
            return findings.stream().anyMatch(f -> ENGINE.equals(f.section()));
        }
    }

    /** The definition's family column. */
    static final int MAX_FAMILY = 96;

    /** Section of the findings for fields the engine does not evaluate yet. */
    static final String ENGINE = "engine";

    private SpecValidator() {
    }

    public static Report validate(SymptomSpec spec, DataSource source) {
        return validate(spec, source, condition -> Optional.empty());
    }

    public static Report validate(SymptomSpec spec, DataSource source,
            Function<String, Optional<String>> contactProblem) {
        return validate(spec, source, contactProblem, result -> true);
    }

    public static Report validate(SymptomSpec spec, DataSource source,
            Function<String, Optional<String>> contactProblem, Predicate<String> knownResult) {
        List<Finding> out = new ArrayList<>();
        if (source == null) {
            out.add(new Finding("source", Severity.ERROR, RuleMessage.of("sourceMissing"), -1));
            return new Report(out);
        }
        RuleSchema schema = RuleSchema.of(source);
        rule(out, ACTIVATION, schema, spec.activation(), Expect.CONDITION);
        duplicates(out, spec.activation());
        out.addAll(ConditionChecks.check(spec.activation(), path -> label(source, path)));
        unknownValues(out, source, spec.activation());
        if (spec.measure() != null && spec.measure().expression() != null) {
            rule(out, MEASURE, schema, spec.measure().expression(), Expect.NUMBER);
        }
        levels(out, schema.withExtras(RuleSchema.LEVEL_VARIABLES), spec.levels());
        operatorConditions(out, schema, source, spec.levels());
        if (spec.measure() == null || spec.measure().expression() == null) {
            levelsWithoutMeasure(out, spec.levels());
        }
        if (spec.lifecycle() == null) {
            out.add(new Finding("lifecycle", Severity.ERROR, RuleMessage.of("lifecycleMissing"), -1));
        } else {
            RuleSchema lifecycle = RuleSchema.lifecycle(source);
            rule(out, "lifecycle.open", lifecycle, spec.lifecycle().open(), Expect.CONDITION);
            rule(out, "lifecycle.close", lifecycle, spec.lifecycle().close(), Expect.CONDITION);
            if (spec.lifecycle().note() != null) {
                rule(out, "lifecycle.note", lifecycle, spec.lifecycle().note(), Expect.CONDITION);
            }
        }
        contactConditions(out, spec, contactProblem);
        replyResults(out, spec, knownResult);
        recurrence(out, spec.recurrence());
        engineSupport(out, source, spec);
        if (spec.family() != null && spec.family().codePointCount(0, spec.family().length()) > MAX_FAMILY) {
            out.add(new Finding("family", Severity.ERROR, RuleMessage.of("familyTooLong", "max", MAX_FAMILY), -1));
        }
        if (spec.state() == SymptomState.ACTIVE && out.stream().anyMatch(f -> ENGINE.equals(f.section()))) {
            out.add(new Finding("state", Severity.ERROR, RuleMessage.of("engineNotReady"), -1));
        }
        return new Report(out);
    }

    private static void replyResults(List<Finding> out, SymptomSpec spec, Predicate<String> knownResult) {
        if (spec.levels() == null) return;
        for (Level level : spec.levels()) {
            if (level.applies() && level.response() != null) {
                stepReplyResults(out, LEVEL_SECTION_PREFIX + level.icu() + RESPONSE_SUFFIX,
                        level.response().steps(), knownResult);
            }
        }
    }

    private static void stepReplyResults(List<Finding> out, String section, List<SymptomSpec.Step> steps,
            Predicate<String> knownResult) {
        if (steps == null) return;
        for (int i = 0; i < steps.size(); i++) {
            checkReplies(out, section, i + 1, steps.get(i).replies(), knownResult);
        }
    }

    private static void checkReplies(List<Finding> out, String section, int step,
            List<SymptomSpec.Step.Reply> replies, Predicate<String> knownResult) {
        if (replies == null) return;
        for (SymptomSpec.Step.Reply reply : replies) {
            String result = reply == null ? null : reply.result();
            if (result == null || result.isBlank() || !knownResult.test(result)) {
                out.add(new Finding(section, Severity.ERROR,
                        RuleMessage.of("stepReplyInvalidResult", "n", step, "result", result == null ? "" : result), -1));
            }
        }
    }

    private static void contactConditions(List<Finding> out, SymptomSpec spec,
            Function<String, Optional<String>> check) {
        if (spec.levels() == null) return;
        for (SymptomSpec.Level level : spec.levels()) {
            SymptomSpec.Response response = level.response();
            if (response == null) continue;
            String section = LEVEL_SECTION_PREFIX + level.icu() + RESPONSE_SUFFIX;
            contactCondition(out, section, response.escalateWho(), check);
            if (response.steps() != null) {
                for (SymptomSpec.Step step : response.steps()) {
                    contactCondition(out, section, step.who(), check);
                }
            }
        }
    }

    private static void contactCondition(List<Finding> out, String section, String who,
            Function<String, Optional<String>> check) {
        if (who == null || who.isBlank()) return;
        check.apply(who).ifPresent(problem -> out.add(new Finding(section, Severity.ERROR,
                RuleMessage.of("contactConditionInvalid", "detail", problem), -1)));
    }

    private static void rule(List<Finding> out, String section, RuleSchema schema, String rule, Expect expect) {
        RuleCheck check = RuleLanguage.check(schema, rule, expect);
        check.issues().forEach(i -> out.add(new Finding(section, Severity.ERROR, i.text(), i.position())));
    }

    private static void levels(List<Finding> out, RuleSchema schema, List<Level> levels) {
        if (levels == null || levels.stream().noneMatch(Level::applies)) {
            out.add(new Finding(LEVELS, Severity.ERROR, RuleMessage.of("noLevelApplies"), -1));
            return;
        }
        Set<Integer> seen = new HashSet<>();
        List<Level> valid = new ArrayList<>();
        for (Level level : levels) {
            if (level.icu() < 1 || level.icu() > 4 || !seen.add(level.icu())) {
                out.add(new Finding(LEVELS, Severity.ERROR, RuleMessage.of("levelsOutOfRange"), -1));
                return;
            }
            if (!level.applies()) {
                continue;
            }
            String section = LEVEL_SECTION_PREFIX + level.icu();
            int before = out.size();
            rule(out, section, schema, level.when(), Expect.CONDITION);
            response(out, section + RESPONSE_SUFFIX, level.response());
            ignore(out, section + ".ignore", level.ignore());
            if (out.size() == before) {
                valid.add(level);
            }
        }
        overlaps(out, schema, valid);
        gaps(out, schema, valid);
    }

    private static void recurrence(List<Finding> out, SymptomSpec.Recurrence r) {
        if (r == null || !r.enabled()) {
            return;
        }
        if (r.entity() != null && !r.entity().equals(SymptomSpec.Recurrence.VEHICLE)
                && !r.entity().equals(SymptomSpec.Recurrence.DRIVER)) {
            out.add(new Finding("recurrence", Severity.ERROR, RuleMessage.of("recurrenceEntity"), -1));
        }
        if (r.count() < 2 || r.days() < 1 || r.raiseLevels() < 1) {
            out.add(new Finding("recurrence", Severity.ERROR, RuleMessage.of("recurrenceMinimum"), -1));
        }
    }

    private static void response(List<Finding> out, String section, SymptomSpec.Response response) {
        if (response == null) {
            return;
        }
        if (response.operator() && (response.slaMinutes() == null || response.slaMinutes() <= 0)) {
            out.add(new Finding(section, Severity.ERROR, RuleMessage.of("operatorNeedsSla"), -1));
        }
        steps(out, section, response.steps());
    }

    /** A maximum duration that is a positive ISO-8601 duration, and known scopes. */
    private static void ignore(List<Finding> out, String section, SymptomSpec.Ignore ignore) {
        if (ignore == null) {
            return;
        }
        try {
            java.time.Duration max = ignore.maxDurationValue();
            if (max != null && max.compareTo(java.time.Duration.ofSeconds(1)) < 0) {
                out.add(new Finding(section, Severity.ERROR, RuleMessage.of("ignoreMaxDuration"), -1));
            }
        } catch (IllegalArgumentException e) {
            out.add(new Finding(section, Severity.ERROR, RuleMessage.of("ignoreMaxDuration"), -1));
        }
        if (ignore.scopes() != null && (ignore.scopes().isEmpty()
                || !SymptomSpec.Ignore.VALID_SCOPES.containsAll(ignore.scopes()))) {
            out.add(new Finding(section, Severity.ERROR, RuleMessage.of("ignoreScopes"), -1));
        }
    }

    /**
     * A step says whom to contact when it has a contact condition. An older step does when it names a role, or its
     * scope is the driver or the trip's carrier (any of its contacts); an unknown scope does not.
     */
    static boolean saysWhom(SymptomSpec.Step step) {
        if (step.hasWho()) {
            return true;
        }
        String scope = step.scope();
        if (scope != null && !scope.isBlank() && !SymptomSpec.Step.SCOPES.contains(scope)) {
            return false;
        }
        boolean hasRole = step.role() != null && !step.role().isBlank();
        if (scope == null || scope.isBlank()) {
            return hasRole;
        }
        return hasRole || !SymptomSpec.Step.ORG.equals(scope);
    }

    /** Each step says whom to contact and has minutes; the script is optional. */
    private static void steps(List<Finding> out, String section, List<SymptomSpec.Step> steps) {
        if (steps == null) {
            return;
        }
        for (int i = 0; i < steps.size(); i++) {
            SymptomSpec.Step step = steps.get(i);
            if (!saysWhom(step)) {
                out.add(new Finding(section, Severity.ERROR, RuleMessage.of("stepNoContact", "n", i + 1), -1));
            }
            if (step.budgetMinutes() == null || step.budgetMinutes() <= 0) {
                out.add(new Finding(section, Severity.ERROR, RuleMessage.of("stepNoMinutes", "n", i + 1), -1));
            }
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
        // A case has held for zero seconds or more.
        List<Double> heldPoints = points.stream().filter(p -> p >= 0).toList();
        Set<String> reported = new HashSet<>();
        for (double held : mentions(levels, HELD) ? heldPoints : List.of(0.0)) {
            for (double open : mentions(levels, OPEN) ? heldPoints : List.of(0.0)) {
                for (double measure : mentions(levels, MEASURE) ? points : List.of(0.0)) {
                    Map<String, Object> vars = Map.of(MEASURE, measure, HELD, held, OPEN, open);
                    List<Level> hits = levels.stream()
                            .filter(l -> Boolean.TRUE.equals(rules.get(l).run(vars).value()))
                            .toList();
                    reportOverlaps(out, reported, hits, measure, held, open);
                }
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

    /**
     * Values between two levels where none applies. Measure ladders are
     * tried with all the hold time in the world; ladders on hold time alone
     * with a measure of zero.
     */
    private static void gaps(List<Finding> out, RuleSchema schema, List<Level> levels) {
        boolean byMeasure = mentions(levels, MEASURE);
        if (!byMeasure && !mentions(levels, HELD) && !mentions(levels, OPEN)) {
            return;
        }
        List<PreparedRule> rules = levels.stream().map(l -> RuleLanguage.prepare(schema, l.when())).toList();
        List<Double> ages = byMeasure && mentions(levels, OPEN)
                ? testPoints(levels).stream().filter(p -> p >= 0).toList() : List.of(1e9);
        Set<Finding> found = new java.util.LinkedHashSet<>();
        for (double age : ages) {
            measureGaps(found, levels, rules, byMeasure, age);
        }
        out.addAll(found);
    }

    private static void measureGaps(Set<Finding> out, List<Level> levels, List<PreparedRule> rules,
            boolean byMeasure, double age) {
        List<Double> thresholds = levels.stream().flatMap(l -> RuleText.numbers(l.when()).stream()).toList();
        boolean held = !byMeasure;
        boolean seenCovered = false;
        Double gapStart = null;
        for (double point : testPoints(levels)) {
            boolean covered = covered(rules, byMeasure, point, age);
            if (covered && gapStart != null) {
                out.add(gap(threshold(gapStart, thresholds), threshold(point, thresholds), held));
                gapStart = null;
            } else if (!covered && seenCovered && gapStart == null) {
                gapStart = point;
            }
            seenCovered |= covered;
        }
    }

    /** A level compared against the measure when the symptom has none. */
    private static void levelsWithoutMeasure(List<Finding> out, List<Level> levels) {
        if (levels == null) {
            return;
        }
        for (Level level : levels) {
            // A rule that does not parse has its own error.
            if (level.applies() && RuleText.identifiers(level.when()).contains(MEASURE)) {
                out.add(new Finding(LEVEL_SECTION_PREFIX + level.icu(), Severity.ERROR, RuleMessage.of("measureMissing"), -1));
            }
        }
    }

    private static boolean mentions(List<Level> levels, String variable) {
        return levels.stream().anyMatch(l -> l.when() != null && l.when().contains(variable));
    }

    /** Whether any level applies at this point of the ladder. */
    private static boolean covered(List<PreparedRule> rules, boolean byMeasure, double point, double age) {
        Map<String, Object> vars = byMeasure ? Map.of(MEASURE, point, HELD, 1e9, OPEN, age)
                : Map.of(MEASURE, 0.0, HELD, point, OPEN, point);
        return rules.stream().anyMatch(r -> Boolean.TRUE.equals(r.run(vars).value()));
    }

    private static Finding gap(double from, double to, boolean held) {
        String suffix = held ? "Held" : "";
        RuleMessage message = from == to
                ? RuleMessage.of("gapAt" + suffix, "at", number(from))
                : RuleMessage.of("gapBetween" + suffix, "from", number(from), "to", number(to));
        return new Finding(LEVELS, Severity.WARNING, message, -1);
    }

    /** The rule number a test point was taken next to. */
    private static double threshold(double point, List<Double> thresholds) {
        return thresholds.stream()
                .filter(n -> Math.abs(n - point) <= NEAR * 1.5)
                .min(Comparator.comparingDouble(n -> Math.abs(n - point)))
                .orElse(point);
    }

    /** A list field compared with a value it does not take, anywhere in the activation. */
    /**
     * A level's {@code operatorWhen} reads what the activation reads; it is checked only where it counts, on a
     * level that applies and has {@code operator}.
     */
    private static void operatorConditions(List<Finding> out, RuleSchema schema, DataSource source,
            List<Level> levels) {
        if (levels == null) {
            return;
        }
        for (Level level : levels) {
            SymptomSpec.Response response = level.response();
            if (!level.applies() || response == null || !response.operator() || response.operatorWhen() == null) {
                continue;
            }
            String section = LEVEL_SECTION_PREFIX + level.icu() + RESPONSE_SUFFIX + ".operatorWhen";
            rule(out, section, schema, response.operatorWhen(), Expect.CONDITION);
            unknownValues(out, source, response.operatorWhen(), section);
        }
    }

    private static void unknownValues(List<Finding> out, DataSource source, String activation) {
        unknownValues(out, source, activation, ACTIVATION);
    }

    private static void unknownValues(List<Finding> out, DataSource source, String rule, String section) {
        Set<String> reported = new HashSet<>();
        for (RuleText.TextComparison c : RuleText.textComparisons(rule)) {
            SourceField field = source.fields().stream().filter(f -> f.path().equals(c.path())).findFirst()
                    .orElse(null);
            if (field == null || field.values() == null || field.values().isEmpty()) {
                continue;
            }
            List<String> known = field.values().stream().map(SourceField.FieldValue::value).toList();
            if (!known.contains(c.value()) && reported.add(c.path() + "=" + c.value())) {
                out.add(new Finding(section, Severity.WARNING, RuleMessage.of("unknownValue",
                        "field", field.label(), "value", c.value(), "values", String.join(", ", known)), -1));
            }
        }
    }

    private static String label(DataSource source, String path) {
        return source.fields().stream()
                .filter(f -> f.path().equals(path) && f.label() != null && !f.label().isBlank())
                .map(SourceField::label)
                .findFirst()
                .orElse(path);
    }

    private static void reportOverlaps(List<Finding> out, Set<String> reported, List<Level> hits, double measure,
            double held, double open) {
        for (int i = 0; i + 1 < hits.size(); i++) {
            int a = hits.get(i).icu();
            int b = hits.get(i + 1).icu();
            if (reported.add(a + "-" + b)) {
                out.add(new Finding(LEVELS, Severity.ERROR, RuleMessage.of("levelsOverlap", "levelA", a, "levelB", b,
                        MEASURE, number(measure), "held", number(held), OPEN, number(open)), -1));
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
                out.add(new Finding(ACTIVATION, Severity.ERROR, RuleMessage.of("conditionRepeated", "term", term),
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
            if (quoted && c == '\\') {
                i++;
            } else if (c == '"') {
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
        Set<String> reported = new HashSet<>();
        for (String rule : engineRules(spec)) {
            for (String path : RuleText.fieldPaths(rule)) {
                if (unsupported.contains(path) && reported.add(path)) {
                    out.add(new Finding(ENGINE, Severity.WARNING, RuleMessage.of("engineUnsupported", "path", path),
                            rule.indexOf(path)));
                }
            }
        }
    }

    private static List<String> engineRules(SymptomSpec spec) {
        List<String> rules = new ArrayList<>();
        rules.add(spec.activation());
        if (spec.measure() != null) {
            rules.add(spec.measure().expression());
        }
        if (spec.levels() != null) {
            spec.levels().stream().filter(Level::applies).forEach(l -> rules.add(l.when()));
            spec.levels().stream().filter(Level::applies)
                    .filter(l -> l.response() != null && l.response().operator())
                    .forEach(l -> rules.add(l.response().operatorWhen()));
        }
        if (spec.lifecycle() != null) {
            rules.add(spec.lifecycle().open());
            rules.add(spec.lifecycle().close());
            rules.add(spec.lifecycle().note());
        }
        return rules;
    }

    static String number(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }
}

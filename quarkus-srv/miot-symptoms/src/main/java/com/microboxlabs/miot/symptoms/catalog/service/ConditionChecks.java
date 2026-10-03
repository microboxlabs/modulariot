package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Finding;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Severity;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Checks on an activation written as conditions joined by {@code &&}: two
 * conditions on the same field that can never both hold, and bounds that
 * repeat. Parentheses around {@code &&} groups are ignored; rules with a
 * top-level {@code ||} are left alone.
 */
final class ConditionChecks {

    private static final String FIELD = "[A-Za-z_][\\w.]*";
    private static final Pattern COMPARISON = Pattern.compile(
            "^(" + FIELD + ")\\s*(==|!=|>=|<=|>|<)\\s*(\"[^\"]*\"|[\\w.-]+)$");
    private static final Pattern BARE = Pattern.compile("^(!?)(" + FIELD + ")$");
    private static final Pattern NUMBER = Pattern.compile("-?\\d+(?:\\.\\d+)?");

    private ConditionChecks() {
    }

    /** The conditions of a rule that only joins them with {@code &&}; empty when it uses {@code ||} at the top. */
    static Optional<List<String>> conjunction(String rule) {
        if (rule == null || rule.isBlank()) {
            return Optional.empty();
        }
        Optional<List<String>> parts = split(rule);
        if (parts.isEmpty()) {
            return parts;
        }
        List<String> terms = new ArrayList<>();
        for (String part : parts.get()) {
            Optional<List<String>> inner = wrapped(part) ? conjunction(part.substring(1, part.length() - 1))
                    : Optional.empty();
            if (inner.isPresent()) {
                terms.addAll(inner.get());
            } else {
                terms.add(SpecDiff.squash(part));
            }
        }
        return Optional.of(terms);
    }

    private static Optional<List<String>> split(String rule) {
        List<String> terms = new ArrayList<>();
        int depth = 0;
        boolean quoted = false;
        int start = 0;
        int i = 0;
        while (i < rule.length()) {
            char c = rule.charAt(i);
            int step = 1;
            if (c == '"') {
                quoted = !quoted;
            } else if (!quoted && (c == '(' || c == '[')) {
                depth++;
            } else if (!quoted && (c == ')' || c == ']')) {
                depth--;
            } else if (!quoted && depth == 0 && rule.startsWith("||", i)) {
                return Optional.empty();
            } else if (!quoted && depth == 0 && rule.startsWith("&&", i)) {
                terms.add(rule.substring(start, i).strip());
                start = i + 2;
                step = 2;
            }
            i += step;
        }
        terms.add(rule.substring(start).strip());
        return Optional.of(terms);
    }

    /** True when the whole term sits inside one pair of parentheses. */
    private static boolean wrapped(String term) {
        if (term.length() < 2 || term.charAt(0) != '(' || term.charAt(term.length() - 1) != ')') {
            return false;
        }
        int depth = 0;
        boolean quoted = false;
        for (int i = 0; i < term.length() - 1; i++) {
            char c = term.charAt(i);
            if (c == '"') {
                quoted = !quoted;
            } else if (!quoted && c == '(') {
                depth++;
            } else if (!quoted && c == ')' && --depth == 0) {
                return false;
            }
        }
        return true;
    }

    /** What the conditions on one field say. */
    private static final class FieldBounds {
        Boolean truth;
        boolean truthClash;
        String equals;
        boolean equalsClash;
        Double number;
        final List<String> notEquals = new ArrayList<>();
        Double lower;
        boolean lowerStrict;
        int lowers;
        Double upper;
        boolean upperStrict;
        int uppers;
    }

    /** Contradictions (errors) and repeated bounds (warnings) among the activation's conditions. */
    static List<Finding> check(String rule, UnaryOperator<String> label) {
        Optional<List<String>> terms = conjunction(rule);
        if (terms.isEmpty()) {
            return List.of();
        }
        Map<String, FieldBounds> fields = new LinkedHashMap<>();
        for (String term : terms.get()) {
            read(term, fields);
        }
        List<Finding> out = new ArrayList<>();
        fields.forEach((field, b) -> report(label.apply(field), b, out));
        return out;
    }

    private static void read(String term, Map<String, FieldBounds> fields) {
        Matcher bare = BARE.matcher(term);
        if (bare.matches()) {
            truth(fields.computeIfAbsent(bare.group(2), f -> new FieldBounds()), bare.group(1).isEmpty());
            return;
        }
        Matcher m = COMPARISON.matcher(term);
        if (!m.matches()) {
            return;
        }
        String op = m.group(2);
        String raw = m.group(3);
        boolean numeric = NUMBER.matcher(raw).matches();
        boolean bool = raw.equals("true") || raw.equals("false");
        if (!numeric && !bool && !raw.startsWith("\"")) {
            // Another field or an expression: nothing to compare against.
            return;
        }
        FieldBounds b = fields.computeIfAbsent(m.group(1), f -> new FieldBounds());
        if (bool) {
            truth(b, op.equals("==") == Boolean.parseBoolean(raw));
            return;
        }
        String value = numeric ? new BigDecimal(raw).stripTrailingZeros().toPlainString() : raw;
        if (op.equals("==")) {
            b.equalsClash |= b.equals != null && !b.equals.equals(value);
            b.equals = value;
            b.number = numeric ? Double.valueOf(value) : null;
        } else if (op.equals("!=")) {
            b.notEquals.add(value);
        } else if (numeric) {
            // An order on a string is a type error the rule check reports.
            bound(b, op, Double.parseDouble(value));
        }
    }

    private static void bound(FieldBounds b, String op, double value) {
        switch (op) {
            case ">", ">=" -> lower(b, value, op.equals(">"));
            default -> upper(b, value, op.equals("<"));
        }
    }

    private static void truth(FieldBounds b, boolean value) {
        b.truthClash |= b.truth != null && b.truth != value;
        b.truth = value;
    }

    private static void lower(FieldBounds b, double value, boolean strict) {
        b.lowers++;
        if (b.lower == null || value > b.lower || (value == b.lower && strict)) {
            b.lower = value;
            b.lowerStrict = strict;
        }
    }

    private static void upper(FieldBounds b, double value, boolean strict) {
        b.uppers++;
        if (b.upper == null || value < b.upper || (value == b.upper && strict)) {
            b.upper = value;
            b.upperStrict = strict;
        }
    }

    private static void report(String name, FieldBounds b, List<Finding> out) {
        if (b.truthClash) {
            out.add(error("«" + name + "» no puede ser verdadero y falso a la vez; nunca se cumpliría."));
        }
        if (b.equalsClash || (b.equals != null && b.notEquals.contains(b.equals))) {
            out.add(error("«" + name + "» no puede tener dos valores a la vez; nunca se cumpliría."));
        }
        if (b.lower != null && b.upper != null
                && (b.lower > b.upper || (b.lower.equals(b.upper) && (b.lowerStrict || b.upperStrict)))) {
            out.add(error("«" + name + "» mayor que " + SpecValidator.number(b.lower) + " y menor que "
                    + SpecValidator.number(b.upper) + " nunca se cumple."));
        }
        if (!b.equalsClash && b.number != null && outside(b)) {
            out.add(error("«" + name + "» igual a " + SpecValidator.number(b.number)
                    + " queda fuera de sus otros límites; nunca se cumpliría."));
        }
        if (b.lowers > 1) {
            out.add(warning("Dos mínimos para «" + name + "»; basta el mayor (" + SpecValidator.number(b.lower)
                    + ")."));
        }
        if (b.uppers > 1) {
            out.add(warning("Dos máximos para «" + name + "»; basta el menor (" + SpecValidator.number(b.upper)
                    + ")."));
        }
    }

    private static boolean outside(FieldBounds b) {
        double v = b.number;
        boolean belowLower = b.lower != null && (v < b.lower || (v == b.lower && b.lowerStrict));
        boolean aboveUpper = b.upper != null && (v > b.upper || (v == b.upper && b.upperStrict));
        return belowLower || aboveUpper;
    }

    private static Finding error(String message) {
        return new Finding("activation", Severity.ERROR, message, -1);
    }

    private static Finding warning(String message) {
        return new Finding("activation", Severity.WARNING, message, -1);
    }
}

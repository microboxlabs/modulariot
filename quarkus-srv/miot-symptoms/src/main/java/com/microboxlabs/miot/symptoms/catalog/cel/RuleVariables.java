package com.microboxlabs.miot.symptoms.catalog.cel;

import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The variables a rule reads besides its source: the case of a lifecycle rule and the extras of a level rule.
 * Each one has its type, its unit and what it means in Spanish and English. The rule checker, the rule
 * descriptions and the editor's autocomplete all read this list.
 */
public final class RuleVariables {

    static final String NUMBER = "number";
    static final String BOOL = "bool";
    private static final String SECONDS = "s";

    /** A variable with its type, its unit (null when it has none) and its meaning in Spanish and English. */
    public record Variable(String path, String type, String unit, String es, String en) {

        /** The meaning in English for an {@code en} locale, in Spanish otherwise. */
        public String label(String locale) {
            return locale != null && locale.toLowerCase(Locale.ROOT).startsWith("en") ? en : es;
        }

        public SourceField field(String locale) {
            return new SourceField(path, label(locale), type, unit, null, true);
        }
    }

    /** The case a lifecycle rule reads. */
    public static final List<Variable> CASE = List.of(
            new Variable("case.condition_s", NUMBER, SECONDS, "segundos con la condición presente",
                    "seconds the condition has been present"),
            new Variable("case.normal_s", NUMBER, SECONDS, "segundos desde que volvió a la normalidad",
                    "seconds since it went back to normal"),
            new Variable("case.off_trip_s", NUMBER, SECONDS, "segundos fuera de un viaje",
                    "seconds outside a trip"),
            new Variable("case.age_h", NUMBER, "h", "horas desde que se abrió el caso",
                    "hours since the case opened"),
            new Variable("case.level", NUMBER, null, "nivel del caso", "the case's level"),
            new Variable("case.closed_by_operator", BOOL, null, "el operador cerró el caso",
                    "an operator closed the case"),
            new Variable("case.closed_on_trip", BOOL, null,
                    "el operador ya cerró un caso de este síntoma en el viaje",
                    "an operator already closed a case of this symptom on the trip"),
            new Variable("case.closed_on_trip_s", NUMBER, SECONDS,
                    "segundos desde que el operador cerró un caso de este síntoma en el viaje; -1 sin cierre en"
                            + " el viaje",
                    "seconds since an operator closed a case of this symptom on the trip; -1 without a close on"
                            + " the trip"));

    /** The variables a level condition adds to the source: the measure and how long it has held. */
    public static final List<Variable> LEVEL = List.of(
            new Variable("measure", NUMBER, null, "valor medido", "the measured value"),
            new Variable("held_s", NUMBER, SECONDS, "segundos que lleva la condición",
                    "seconds the condition has held"),
            new Variable("open_s", NUMBER, SECONDS, "segundos desde que se abrió el caso",
                    "seconds since the case opened"));

    private RuleVariables() {
    }

    /** Path to type, in list order. */
    public static Map<String, String> types(List<Variable> variables) {
        Map<String, String> out = new LinkedHashMap<>();
        variables.forEach(v -> out.put(v.path(), v.type()));
        return Collections.unmodifiableMap(out);
    }

    /** Path to meaning in the locale, in list order. */
    public static Map<String, String> labels(List<Variable> variables, String locale) {
        Map<String, String> out = new LinkedHashMap<>();
        variables.forEach(v -> out.put(v.path(), v.label(locale)));
        return Collections.unmodifiableMap(out);
    }
}

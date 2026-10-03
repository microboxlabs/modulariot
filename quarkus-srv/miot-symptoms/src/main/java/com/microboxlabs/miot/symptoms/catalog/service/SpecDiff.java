package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.cel.RuleText;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionBump;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * What changed between two specs, in plain Spanish, and the version bump
 * each change needs. MAJOR: source, activation or measure. MINOR:
 * thresholds, a level turned on or off, lifecycle or recurrence. PATCH: family, state, the
 * response or the measure's label.
 */
public final class SpecDiff {

    static final String[] LEVEL_NAMES = {"Bajo observación", "Comprometida", "Crítica", "Código negro"};

    /** One difference. */
    public record Change(String section, VersionBump bump, String text) {
    }

    private SpecDiff() {
    }

    public static List<Change> changes(SymptomSpec before, SymptomSpec after) {
        List<Change> out = new ArrayList<>();
        if (before == null) {
            out.add(new Change("identity", VersionBump.MAJOR, "Primera versión"));
            return out;
        }
        if (!Objects.equals(before.source(), after.source())) {
            out.add(new Change("source", VersionBump.MAJOR, "Cambió la fuente de datos"));
        }
        if (!sameRule(before.activation(), after.activation())) {
            out.add(new Change("activation", VersionBump.MAJOR, "Cambió cuándo se activa"));
        }
        measureChanges(before.measure(), after.measure(), out);
        levelChanges(before.levels(), after.levels(), out);
        if (!Objects.equals(normalized(before.lifecycle()), normalized(after.lifecycle()))) {
            out.add(new Change("lifecycle", VersionBump.MINOR, "Cambió cuándo se abre o se cierra el caso"));
        }
        if (!Objects.equals(normalized(before.recurrence()), normalized(after.recurrence()))) {
            out.add(new Change("recurrence", VersionBump.MINOR, "Cambió qué pasa si se repite"));
        }
        if (after.family() != null && !Objects.equals(before.family(), after.family())) {
            out.add(new Change("family", VersionBump.PATCH, "Cambió la familia"));
        }
        if (after.state() != null && before.state() != after.state()) {
            out.add(new Change("state", VersionBump.PATCH,
                    "Estado: " + stateName(before.state()) + " → " + stateName(after.state())));
        }
        return out;
    }

    /** The largest bump among the changes, or null when nothing changed. */
    private static String stateName(SymptomState state) {
        if (state == null) {
            return "sin estado";
        }
        return switch (state) {
            case OFF -> "Apagado";
            case TEST -> "En prueba";
            case ACTIVE -> "Activo";
        };
    }

    public static VersionBump bump(List<Change> changes) {
        return changes.stream().map(Change::bump).max(Enum::compareTo).orElse(null);
    }

    /** The version after {@code current} for this bump. The first version is 1.0.0. */
    public static String next(String current, VersionBump bump) {
        if (current == null) {
            return "1.0.0";
        }
        String[] p = current.split("\\.");
        int major = Integer.parseInt(p[0]);
        int minor = Integer.parseInt(p[1]);
        int patch = Integer.parseInt(p[2]);
        return switch (bump) {
            case MAJOR -> (major + 1) + ".0.0";
            case MINOR -> major + "." + (minor + 1) + ".0";
            case PATCH -> major + "." + minor + "." + (patch + 1);
        };
    }

    private static void measureChanges(SymptomSpec.Measure before, SymptomSpec.Measure after, List<Change> out) {
        String b = before == null ? null : before.expression();
        String a = after == null ? null : after.expression();
        if (!sameRule(b, a)) {
            out.add(new Change("measure", VersionBump.MAJOR, "Cambió la medida"));
        } else if (!Objects.equals(before, after)) {
            out.add(new Change("measure", VersionBump.PATCH, "Cambió el nombre o la unidad de la medida"));
        }
    }

    private static void levelChanges(List<Level> before, List<Level> after, List<Change> out) {
        for (int icu = 1; icu <= 4; icu++) {
            Level b = level(before, icu);
            Level a = level(after, icu);
            String name = LEVEL_NAMES[icu - 1];
            if (applies(b) != applies(a)) {
                out.add(new Change("levels", VersionBump.MINOR,
                        (applies(a) ? "Se activó el nivel " : "Se desactivó el nivel ") + name));
            } else if (applies(a) && !sameRule(b.when(), a.when())) {
                out.add(new Change("levels", VersionBump.MINOR, "Cambió el umbral de " + name));
            }
            if (applies(a) && applies(b) && !Objects.equals(b.response(), a.response())) {
                out.add(new Change("response", VersionBump.PATCH, "Cambió la respuesta de " + name));
            }
        }
    }

    private static Level level(List<Level> levels, int icu) {
        return levels == null ? null : levels.stream().filter(l -> l.icu() == icu).findFirst().orElse(null);
    }

    private static boolean applies(Level level) {
        return level != null && level.applies();
    }

    private static boolean sameRule(String before, String after) {
        return Objects.equals(squash(before), squash(after));
    }

    /** A recurrence without an entity counts per vehicle. */
    private static SymptomSpec.Recurrence normalized(SymptomSpec.Recurrence r) {
        return r == null || r.entity() != null ? r
                : new SymptomSpec.Recurrence(r.enabled(), r.count(), r.days(), r.raiseLevels(),
                        SymptomSpec.Recurrence.VEHICLE);
    }

    private static SymptomSpec.Lifecycle normalized(SymptomSpec.Lifecycle l) {
        return l == null ? null : new SymptomSpec.Lifecycle(squash(l.open()), squash(l.close()), l.levelDown());
    }

    /** Formatting does not change a rule; text inside string literals does. */
    static String squash(String rule) {
        return RuleText.canonical(rule);
    }
}

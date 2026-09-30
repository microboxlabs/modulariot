package com.microboxlabs.miot.symptoms.catalog.service;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Response;
import com.microboxlabs.miot.symptoms.engine.EngineRule;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Turns an engine rule (its JSON pattern) into a symptom spec in CEL. Keys
 * with a known meaning become conditions, a measure or the lifecycle; the
 * rest are listed in {@code pending} for the owner to review. Thresholds the
 * engine keeps in its SQL functions are copied for the symptoms whose
 * ladders are known.
 */
final class EngineRuleTranslator {

    static final String GPS = DataSourceService.GPS_SIGNAL;
    static final String EVENT = "device_event";
    static final String CHECK = "trip_check";

    /** Pattern keys that only tune how the engine runs, handled elsewhere or not at all. */
    private static final Set<String> CONTROL_KEYS = Set.of("evaluate_time", "start_hour", "end_hour",
            "cooldown_seconds");

    private static final String MEASURE_AT_LEAST = "medida >= ";

    /** Result of translating one rule. */
    record Translation(String key, String name, String sourceKey, String icon, SymptomSpec spec,
            List<String> pending) {
    }

    private EngineRuleTranslator() {
    }

    static Translation translate(EngineRule rule) {
        Map<String, Object> p = rule.pattern();
        Draft d = new Draft(sourceOf(rule));
        p.forEach(d::read);
        String hours = hourWindow(p.get("start_hour"), p.get("end_hour"));
        if (hours != null) {
            d.conditions.add(hours);
        }
        List<Level> levels = d.levels == null ? fixedLevel() : d.levels;
        Object cooldown = p.get("cooldown_seconds");
        String close = cooldown instanceof Number n ? "caso.normal_s >= " + n.intValue() : "caso.normal_s >= 0";
        SymptomSpec spec = new SymptomSpec(d.sourceKey,
                d.conditions.isEmpty() ? "true" : String.join(" && ", d.conditions),
                d.measure == null ? null : new SymptomSpec.Measure(d.measure, null, d.unit), levels,
                new SymptomSpec.Lifecycle("caso.condicion_s >= 0", close), null);
        return new Translation(key(rule), rule.name(), d.sourceKey, d.icon, spec, d.pending);
    }

    /** A pattern key that sets the measure. {@code levels} and {@code note} may be null. */
    private record Measured(String measure, String unit, String icon, List<Level> levels, String note) {
    }

    private static final Map<String, Measured> MEASURES = Map.of(
            "maxspeed_infraction_osm", new Measured("signal.gps.speed_kmh - signal.road.maxspeed_osm", "km/h",
                    "SPEED LIMIT STANDARD", speedLevels(), null),
            "maxspeed_infraction_custom", new Measured("signal.gps.speed_kmh - signal.road.maxspeed_custom", "km/h",
                    "SPEED LIMIT CUSTOM", speedLevels(), null),
            "continuous_drive_check", new Measured("check.driving_minutes", "min", "CONTINUOUS DRIVE CHECK",
                    ladder(300, 330, 360), null),
            "continuous_resting_check", new Measured("check.resting_minutes", "min", "CONTINUOUS RESTING CHECK",
                    null, "continuous_resting_check: los umbrales viven en el motor; revisar los niveles"),
            "lost_signal", new Measured("check.signal_lost_minutes", "min", "LOST SIGNAL", ladder(90, 120, 180), null));

    /** What the pattern keys add up to while a rule is read. */
    private static final class Draft {
        final String sourceKey;
        final String root;
        final List<String> conditions = new ArrayList<>();
        final List<String> pending = new ArrayList<>();
        String measure;
        String unit;
        String icon;
        List<Level> levels;

        Draft(String sourceKey) {
            this.sourceKey = sourceKey;
            this.root = switch (sourceKey) {
                case EVENT -> "event";
                case CHECK -> "check";
                default -> "signal";
            };
        }

        void read(String k, Object v) {
            Measured m = MEASURES.get(k);
            if (m != null) {
                take(m);
                return;
            }
            boolean on = isOn(v);
            switch (k) {
                case "in_trip" -> conditions.add(flag(on, root + ".trip.active"));
                case "double_driver" -> conditions.add(flag(on, root + ".trip.double_driver"));
                case "movement_status" -> {
                    // Only the GPS signal says whether the truck moves.
                    if (GPS.equals(sourceKey)) {
                        conditions.add(flag(on, "signal.gps.moving"));
                    } else {
                        pending.add(k + " = " + v);
                    }
                }
                case "tipo_evento" -> conditions.add("event.type == \"" + v + "\"");
                default -> {
                    if (!CONTROL_KEYS.contains(k)) {
                        pending.add(k + " = " + v);
                    }
                }
            }
        }

        private void take(Measured m) {
            measure = m.measure();
            unit = m.unit();
            icon = m.icon();
            if (m.levels() != null) {
                levels = m.levels();
            }
            if (m.note() != null) {
                pending.add(m.note());
            }
        }

        private static String flag(boolean on, String path) {
            return on ? path : "!" + path;
        }
    }

    static String sourceOf(EngineRule rule) {
        if ("event".equals(rule.triggerType()) || rule.pattern().containsKey("tipo_evento")) {
            return EVENT;
        }
        if ("job".equals(rule.triggerType())) {
            return CHECK;
        }
        Map<String, Object> p = rule.pattern();
        return p.containsKey("continuous_drive_check") || p.containsKey("continuous_resting_check") ? CHECK : GPS;
    }

    /** `Exceso de velocidad estandar` (rule 9) → `exceso-de-velocidad-estandar-9`. */
    static String key(EngineRule rule) {
        String base = Normalizer.normalize(rule.name() == null ? "regla" : rule.name(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        String suffix = "-" + rule.id();
        return (base.length() > 90 ? base.substring(0, 90) : base) + suffix;
    }

    /** {@code 21:00:00} to {@code 05:59:59} → {@code (signal.local_hour >= 21 || signal.local_hour < 6)}. */
    static String hourWindow(Object start, Object end) {
        if (!(start instanceof String s) || !(end instanceof String e)) {
            return null;
        }
        double from = Math.floor(hours(s) * 60) / 60;
        double to = Math.ceil(hours(e) * 60) / 60;
        String a = "signal.local_hour >= " + number(from);
        String b = "signal.local_hour < " + number(to);
        return from <= to ? "(" + a + " && " + b + ")" : "(" + a + " || " + b + ")";
    }

    private static double hours(String hhmmss) {
        String[] p = hhmmss.split(":");
        double seconds = p.length > 2 ? Double.parseDouble(p[2]) : 0;
        return Double.parseDouble(p[0]) + Double.parseDouble(p[1]) / 60 + seconds / 3600;
    }

    private static String number(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(Math.round(v * 100) / 100.0);
    }

    private static boolean isOn(Object v) {
        return v instanceof Number n ? n.intValue() != 0 : Boolean.TRUE.equals(v) || "1".equals(String.valueOf(v));
    }

    /** The engine's speeding ladder: 5, 11 and 21 km/h over, código negro only after a minute. */
    private static List<Level> speedLevels() {
        return List.of(
                level(1, "medida > 0 && medida < 5", false, null),
                level(2, "medida >= 5 && medida < 11", false, null),
                level(3, "medida >= 11 && (medida < 21 || sostenido_s < 60)", true, 5),
                level(4, "medida >= 21 && sostenido_s >= 60", true, 2));
    }

    /** ICU 2, 3 and 4 from three thresholds of the measure. */
    private static List<Level> ladder(int compromised, int critical, int black) {
        return List.of(
                new Level(1, false, null, null),
                level(2, MEASURE_AT_LEAST + compromised + " && medida < " + critical, false, null),
                level(3, MEASURE_AT_LEAST + critical + " && medida < " + black, true, 5),
                level(4, MEASURE_AT_LEAST + black, true, 2));
    }

    /** Events go straight to one level; the engine does not say which, so ICU 3 until the owner decides. */
    private static List<Level> fixedLevel() {
        return List.of(new Level(1, false, null, null), new Level(2, false, null, null),
                level(3, "true", true, 5), new Level(4, false, null, null));
    }

    private static Level level(int icu, String when, boolean operator, Integer sla) {
        return new Level(icu, true, when, new Response(operator, sla, List.of(), List.of(), List.of(), true));
    }
}

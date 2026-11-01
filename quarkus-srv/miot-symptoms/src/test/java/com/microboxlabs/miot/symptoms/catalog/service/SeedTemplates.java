package com.microboxlabs.miot.symptoms.catalog.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomTemplate;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The platform templates the V0.9.3 migration seeds, read from the migration itself, with the rules as later
 * migrations leave them: the V0.9.4 and V0.9.5 rewrites, then the new versions of {@link #UPGRADES}.
 */
public final class SeedTemplates {

    static final String MIGRATION = "/db/migration/symptoms/V0.9.3__platform_symptom_templates.sql";

    private static final String TEXT = "'((?:[^']|'')*)'";
    private static final Pattern ROW = Pattern.compile("\\(" + TEXT + ", " + TEXT + ", " + TEXT + ", (NULL|"
            + TEXT + "), " + TEXT + ",\\s*" + TEXT + ",\\s*" + TEXT + "\\)", Pattern.DOTALL);
    /** The rewrites of V0.9.4__signal_without_gps_part.sql, then V0.9.5__panic_rule_optional_read.sql, in order. */
    private static final List<Map.Entry<String, String>> REWRITES = List.of(
            Map.entry("signal\\.gps\\.speed_kmh\\b", "signal.frame.gps.speed"),
            Map.entry("signal\\.gps\\.engine_on\\b", "signal.frame.sensors.engine_status"),
            Map.entry("signal\\.gps\\.moving\\b", "signal.derived.moving"),
            Map.entry("has\\(signal\\.frame\\)(\\s|\\\\+n)*&&(\\s|\\\\+n)*", ""),
            Map.entry("has\\(\\s*signal\\.frame\\.sensors\\s*\\)(\\s|\\\\+n)*&&(\\s|\\\\+n)*"
                    + "has\\(\\s*signal\\.frame\\.sensors\\.panic_button\\s*\\)(\\s|\\\\+n)*&&(\\s|\\\\+n)*"
                    + "signal\\.frame\\.sensors\\.panic_button(\\s*==\\s*true)?\\b",
                    "signal.frame.?sensors.?panic_button == TRUE"));
    /** Migrations that publish a new version of one template: its key and version, and the file. */
    private static final List<Upgrade> UPGRADES = List.of(
            new Upgrade("signal-loss", "2.0.0",
                    "/db/migration/symptoms/V0.12.4__signal_loss_template_reads_detector.sql"),
            new Upgrade("signal-loss", "2.1.0",
                    "/db/migration/symptoms/V0.12.5__signal_loss_template_coverage_cohort.sql"));
    private static final Pattern UPGRADE_SPEC = Pattern.compile("'(\\{\"source\".*?)'::jsonb", Pattern.DOTALL);
    private static final Pattern UPGRADE_DESCRIPTION = Pattern.compile("description = " + TEXT);

    private record Upgrade(String key, String version, String file) {
    }

    private static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    private static final List<SymptomTemplate> ALL = load();

    private SeedTemplates() {
    }

    public static List<SymptomTemplate> all() {
        return ALL;
    }

    public static SymptomTemplate get(String key) {
        return ALL.stream().filter(t -> t.key().equals(key)).findFirst()
                .orElseThrow(() -> new NoSuchElementException("template not found: " + key));
    }

    private static List<SymptomTemplate> load() {
        String sql = read(MIGRATION);
        List<SymptomTemplate> out = new ArrayList<>();
        Matcher m = ROW.matcher(sql);
        while (m.find()) {
            String icon = m.group(5) == null ? null : unquote(m.group(5));
            out.add(new SymptomTemplate(unquote(m.group(1)), unquote(m.group(2)), unquote(m.group(3)), icon,
                    unquote(m.group(6)), "1.0.0", spec(unquote(m.group(8))).withState(null)));
        }
        for (Upgrade u : UPGRADES) {
            String upgrade = read(u.file());
            Matcher spec = UPGRADE_SPEC.matcher(upgrade);
            Matcher description = UPGRADE_DESCRIPTION.matcher(upgrade);
            if (!spec.find() || !description.find()) {
                throw new IllegalStateException("no spec or description in " + u.file());
            }
            out.replaceAll(t -> t.key().equals(u.key()) ? new SymptomTemplate(t.key(), t.name(), t.family(),
                    t.icon(), unquote(description.group(1)), u.version(), spec(unquote(spec.group(1))).withState(null))
                    : t);
        }
        return List.copyOf(out);
    }

    private static String unquote(String text) {
        return text.replace("''", "'");
    }

    private static SymptomSpec spec(String json) {
        String rewritten = json;
        for (Map.Entry<String, String> r : REWRITES) {
            rewritten = rewritten.replaceAll(r.getKey(), r.getValue());
        }
        try {
            return JSON.readValue(rewritten, SymptomSpec.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("bad spec in " + MIGRATION, e);
        }
    }

    private static String read(String file) {
        try (InputStream in = SeedTemplates.class.getResourceAsStream(file)) {
            if (in == null) {
                throw new IllegalStateException("missing " + file);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

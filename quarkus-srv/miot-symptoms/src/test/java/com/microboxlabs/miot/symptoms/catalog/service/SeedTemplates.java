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

/** The platform templates the V0.9.3 migration seeds, read from the migration itself, with the V0.9.4 rule paths. */
public final class SeedTemplates {

    static final String MIGRATION = "/db/migration/symptoms/V0.9.3__platform_symptom_templates.sql";

    private static final String TEXT = "'((?:[^']|'')*)'";
    private static final Pattern ROW = Pattern.compile("\\(" + TEXT + ", " + TEXT + ", " + TEXT + ", (NULL|"
            + TEXT + "), " + TEXT + ",\\s*" + TEXT + ",\\s*" + TEXT + "\\)", Pattern.DOTALL);
    /** The rewrites of V0.9.4__signal_without_gps_part.sql. */
    private static final List<Map.Entry<String, String>> V0_9_4 = List.of(
            Map.entry("has\\(\\s*signal\\.gps\\.speed_kmh\\s*\\)", "has(signal.frame.gps)"),
            Map.entry("has\\(\\s*signal\\.gps\\.engine_on\\s*\\)",
                    "(has(signal.frame.sensors) && has(signal.frame.sensors.engine_status))"),
            Map.entry("(^|[^\\w.])signal\\.gps\\.speed_kmh\\b", "$1signal.frame.gps.speed"),
            Map.entry("(^|[^\\w.])signal\\.gps\\.engine_on\\b", "$1signal.frame.sensors.engine_status"),
            Map.entry("(^|[^\\w.])signal\\.gps\\.moving\\b", "$1signal.derived.moving"),
            Map.entry("([\"(&|](\\s|\\\\n)*)has\\(\\s*signal\\.frame\\s*\\)(\\s|\\\\n)*&&(\\s|\\\\n)*", "$1"));
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
        String sql = read();
        List<SymptomTemplate> out = new ArrayList<>();
        Matcher m = ROW.matcher(sql);
        while (m.find()) {
            String icon = m.group(5) == null ? null : unquote(m.group(5));
            out.add(new SymptomTemplate(unquote(m.group(1)), unquote(m.group(2)), unquote(m.group(3)), icon,
                    unquote(m.group(6)), "1.0.0", spec(unquote(m.group(8))).withState(null)));
        }
        return List.copyOf(out);
    }

    private static String unquote(String text) {
        return text.replace("''", "'");
    }

    private static SymptomSpec spec(String json) {
        String rewritten = json;
        for (Map.Entry<String, String> r : V0_9_4) {
            rewritten = rewritten.replaceAll(r.getKey(), r.getValue());
        }
        try {
            return JSON.readValue(rewritten, SymptomSpec.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("bad spec in " + MIGRATION, e);
        }
    }

    private static String read() {
        try (InputStream in = SeedTemplates.class.getResourceAsStream(MIGRATION)) {
            if (in == null) {
                throw new IllegalStateException("missing " + MIGRATION);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

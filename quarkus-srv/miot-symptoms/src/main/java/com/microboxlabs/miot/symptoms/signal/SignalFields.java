package com.microboxlabs.miot.symptoms.signal;

import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.introspect.AnnotatedMember;
import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.FieldOrigin;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField.FieldValue;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.temporal.Temporal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * The fields of the {@code gps_signal} source, read from {@link GpsSignal}
 * and the gps-model classes of its frame, so the rule editor shows what the
 * signal carries. A field's label is its {@code @Schema} title, or else the
 * entry for its path in {@value #LABELS} ({@code label|unit}).
 */
public final class SignalFields {

    public static final String ROOT = "signal";
    static final String LABELS = "/symptoms/gps-signal-labels.properties";

    /**
     * Frame parts rules do not read: the vehicle id is {@code signal.asset_id}, driver data comes from the
     * trip, and peripherals and metrics are lists, not fields.
     */
    static final Set<String> SKIPPED = Set.of("signal.frame.asset_id", "signal.frame.driver_info",
            "signal.frame.co_driver_info", "signal.frame.peripherals", "signal.frame.metrics");

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int MAX_DEPTH = 5;

    private SignalFields() {
    }

    public static String name() {
        return GpsSignal.class.getAnnotation(Schema.class).title();
    }

    public static String cadence() {
        return extension(GpsSignal.class.getAnnotation(Schema.class), "x-cadence");
    }

    public static List<SourceField> fields() {
        List<SourceField> out = new ArrayList<>();
        walk(JSON.constructType(GpsSignal.class), ROOT, null, labels(), out, 0);
        return List.copyOf(out);
    }

    private static void walk(JavaType type, String prefix, FieldOrigin inherited, Properties labels,
            List<SourceField> out, int depth) {
        if (depth > MAX_DEPTH) {
            return;
        }
        for (BeanPropertyDefinition p : JSON.getSerializationConfig().introspect(type).findProperties()) {
            String path = prefix + "." + p.getName();
            Schema schema = schemaOf(p);
            if (SKIPPED.contains(path) || (schema != null && schema.hidden())) {
                continue;
            }
            String origin = extension(schema, "x-origin");
            FieldOrigin fieldOrigin = origin == null ? inherited : FieldOrigin.valueOf(origin);
            JavaType t = p.getPrimaryType();
            String kind = kindOf(t, extension(schema, "x-type"));
            if (kind == null) {
                if (!t.isContainerType() && !Temporal.class.isAssignableFrom(t.getRawClass())) {
                    walk(t, path, fieldOrigin, labels, out, depth + 1);
                }
                continue;
            }
            String[] entry = labels.getProperty(path, "").split("\\|", 2);
            String label = schema != null && !schema.title().isEmpty() ? schema.title()
                    : !entry[0].isBlank() ? entry[0].trim()
                    : schema != null && !schema.description().isEmpty() ? schema.description() : p.getName();
            String unit = extension(schema, "x-unit");
            if (unit == null && entry.length > 1 && !entry[1].isBlank()) {
                unit = entry[1].trim();
            }
            boolean engine = !"false".equals(extension(schema, "x-engine"));
            out.add(new SourceField(path, label, kind, unit, fieldOrigin, engine,
                    t.isEnumType() ? values(t.getRawClass()) : null));
        }
    }

    private static String kindOf(JavaType t, String override) {
        if (override != null) {
            return override;
        }
        Class<?> c = t.getRawClass();
        if (c == Boolean.class || c == boolean.class) {
            return "bool";
        }
        if (Number.class.isAssignableFrom(c) || (c.isPrimitive() && c != char.class)) {
            return "number";
        }
        if (c == String.class || c == char.class || c == Character.class) {
            return "text";
        }
        if (t.isEnumType()) {
            return "list";
        }
        return null;
    }

    private static List<FieldValue> values(Class<?> enumType) {
        return Arrays.stream(enumType.getEnumConstants()).map(c -> {
            String name = ((Enum<?>) c).name();
            try {
                Schema s = enumType.getField(name).getAnnotation(Schema.class);
                return new FieldValue(name, s == null || s.title().isEmpty() ? name : s.title());
            } catch (NoSuchFieldException e) {
                return new FieldValue(name, name);
            }
        }).toList();
    }

    /** The {@code @Schema} on the property's field, accessor or constructor parameter. */
    private static Schema schemaOf(BeanPropertyDefinition p) {
        for (AnnotatedMember m : new AnnotatedMember[] { p.getField(), p.getGetter(), p.getConstructorParameter() }) {
            Schema s = m == null ? null : m.getAnnotation(Schema.class);
            if (s != null) {
                return s;
            }
        }
        return null;
    }

    private static String extension(Schema schema, String name) {
        if (schema == null) {
            return null;
        }
        return Arrays.stream(schema.extensions()).filter(e -> e.name().equals(name)).map(Extension::value)
                .findFirst().orElse(null);
    }

    private static Properties labels() {
        Properties p = new Properties();
        try (InputStream in = SignalFields.class.getResourceAsStream(LABELS)) {
            if (in != null) {
                p.load(new InputStreamReader(in, StandardCharsets.UTF_8));
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return p;
    }
}

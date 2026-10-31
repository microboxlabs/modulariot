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
 * signal carries; {@code trip_check}'s the same way from {@link TripCheck}. A field's label is its {@code @Schema} title, or else the
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

    /** Optional primitives the editor shows anyway: a frame without speed reads 0, as a stopped vehicle. */
    static final Set<String> ZERO_WHEN_MISSING = Set.of("signal.frame.gps.speed");

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

    /** The fields of another source declared the same way, such as {@link TripCheck}, without a labels file. */
    public static List<SourceField> fields(Class<?> type, String root) {
        List<SourceField> out = new ArrayList<>();
        walk(JSON.constructType(type), root, null, new Properties(), out, 0);
        return List.copyOf(out);
    }

    public static String cadence(Class<?> type) {
        return extension(type.getAnnotation(Schema.class), "x-cadence");
    }

    private static void walk(JavaType type, String prefix, FieldOrigin inherited, Properties labels,
            List<SourceField> out, int depth) {
        if (depth > MAX_DEPTH) {
            return;
        }
        for (BeanPropertyDefinition p : JSON.getSerializationConfig().introspect(type).findProperties()) {
            String path = prefix + "." + p.getName();
            Schema schema = schemaOf(p);
            if (!skipped(path, schema, p.getPrimaryType())) {
                add(p, path, schema, inherited, labels, out, depth);
            }
        }
    }

    /**
     * Listed or hidden parts, and optional primitives: a primitive reads 0 or false when the device did not send
     * it, so a rule could not tell a missing reading from a zero one.
     */
    private static boolean skipped(String path, Schema schema, JavaType t) {
        if (SKIPPED.contains(path) || (schema != null && schema.hidden())) {
            return true;
        }
        return t.isPrimitive() && (schema == null || !schema.required()) && !ZERO_WHEN_MISSING.contains(path);
    }

    private static void add(BeanPropertyDefinition p, String path, Schema schema, FieldOrigin inherited,
            Properties labels, List<SourceField> out, int depth) {
        String origin = extension(schema, "x-origin");
        FieldOrigin fieldOrigin = origin == null ? inherited : FieldOrigin.valueOf(origin);
        JavaType t = p.getPrimaryType();
        String kind = kindOf(t, extension(schema, "x-type"));
        if (kind == null) {
            if (!t.isContainerType() && !Temporal.class.isAssignableFrom(t.getRawClass())) {
                walk(t, path, fieldOrigin, labels, out, depth + 1);
            }
            return;
        }
        String[] entry = labels.getProperty(path, "").split("\\|", 2);
        String unit = extension(schema, "x-unit");
        if (unit == null && entry.length > 1 && !entry[1].isBlank()) {
            unit = entry[1].trim();
        }
        boolean engine = !"false".equals(extension(schema, "x-engine"));
        out.add(new SourceField(path, label(p, schema, entry[0]), kind, unit, fieldOrigin, engine,
                t.isEnumType() ? values(t.getRawClass()) : null));
    }

    /** The {@code @Schema} title, else the labels file entry, else the description, else the property name. */
    private static String label(BeanPropertyDefinition p, Schema schema, String entry) {
        if (schema != null && !schema.title().isEmpty()) {
            return schema.title();
        }
        if (!entry.isBlank()) {
            return entry.trim();
        }
        return schema != null && !schema.description().isEmpty() ? schema.description() : p.getName();
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

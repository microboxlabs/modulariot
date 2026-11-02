package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.core.event.EventTypeCatalog;
import java.lang.reflect.AnnotatedElement;
import java.lang.reflect.RecordComponent;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/**
 * The event types every producer declares ({@link EventTypeCatalog} beans), with the fields of their payload:
 * the payload record's components, labelled by their {@code @Schema} title, and the derived template variables
 * the payload allows.
 */
public final class EventCatalog {

    public record Field(String name, String label, String description, String type) {
    }

    public record EventTypeView(String type, String source, String description, String contextKind,
            List<Field> fields, List<Field> variables) {
    }

    private static final String STRING = "string";
    private static final Set<Class<?>> NUMBERS = Set.of(int.class, long.class, double.class, float.class,
            short.class, byte.class);
    private static final Set<Class<?>> TIMES = Set.of(Instant.class, OffsetDateTime.class, ZonedDateTime.class,
            LocalDateTime.class, LocalDate.class);

    private final List<EventTypeCatalog> catalogs;

    public EventCatalog(List<EventTypeCatalog> catalogs) {
        this.catalogs = List.copyOf(catalogs);
    }

    public List<EventTypeView> types() {
        return types(false);
    }

    /** {@code platform}: only the types that reach the platform's tenant ({@link EventTypeCatalog#platform()}). */
    public List<EventTypeView> types(boolean platform) {
        List<EventTypeView> out = new ArrayList<>();
        for (EventTypeCatalog c : catalogs) {
            if (platform && !c.platform()) {
                continue;
            }
            for (EventTypeCatalog.EventType t : c.types()) {
                List<Field> fields = fields(t.data());
                out.add(new EventTypeView(t.type(), c.source(), t.description(), c.contextKind(), fields,
                        variables(fields)));
            }
        }
        return out;
    }

    /** Event type to its context kind, for the validator. */
    public Map<String, String> contextKinds() {
        Map<String, String> out = new LinkedHashMap<>();
        for (EventTypeCatalog c : catalogs) {
            c.types().forEach(t -> out.put(t.type(), c.contextKind()));
        }
        return out;
    }

    static List<Field> fields(Class<?> data) {
        if (data == null || !data.isRecord()) {
            return List.of();
        }
        List<Field> out = new ArrayList<>();
        for (RecordComponent rc : data.getRecordComponents()) {
            Schema schema = schema(data, rc);
            String label = schema == null || schema.title().isBlank() ? rc.getName() : schema.title();
            String description = schema == null || schema.description().isBlank() ? null : schema.description();
            out.add(new Field(rc.getName(), label, description, type(rc.getType())));
        }
        return out;
    }

    /** {@code @Schema} on a record component lands on its field and accessor, not on the component. */
    private static Schema schema(Class<?> data, RecordComponent rc) {
        List<AnnotatedElement> places = new ArrayList<>();
        places.add(rc);
        places.add(rc.getAccessor());
        try {
            places.add(data.getDeclaredField(rc.getName()));
        } catch (NoSuchFieldException e) {
            // A record always has the field; the accessor is enough otherwise.
        }
        for (AnnotatedElement place : places) {
            Schema s = place.getAnnotation(Schema.class);
            if (s != null) {
                return s;
            }
        }
        return null;
    }

    static String type(Class<?> type) {
        if (type.isArray() || Collection.class.isAssignableFrom(type)) {
            return "array";
        }
        if (Map.class.isAssignableFrom(type)) {
            return "object";
        }
        if (NUMBERS.contains(type) || Number.class.isAssignableFrom(type)) {
            return "number";
        }
        if (type == boolean.class || type == Boolean.class) {
            return "boolean";
        }
        if (TIMES.contains(type)) {
            return "datetime";
        }
        return STRING;
    }

    /** The derived variables whose source fields the payload has; hora, fecha and nombre always. */
    static List<Field> variables(List<Field> fields) {
        Set<String> names = new HashSet<>();
        fields.forEach(f -> names.add(f.name()));
        List<Field> out = new ArrayList<>();
        for (TemplateVariables.Derived d : TemplateVariables.DERIVED) {
            boolean available = switch (d.name()) {
                case "patente" -> names.contains("plate") || names.contains("assetId");
                case "sintoma" -> names.contains("symptomName");
                case "nivel" -> names.contains("level");
                case "ubicacion" -> (names.contains("latitude") || names.contains("lat"))
                        && (names.contains("longitude") || names.contains("lon"));
                default -> true;
            };
            if (available) {
                out.add(new Field(d.name(), d.label(), d.description(), STRING));
            }
        }
        return out;
    }
}

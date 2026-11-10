package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.store.ExternalEventStore;
import com.microboxlabs.miot.core.event.EventTypeCatalog;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * The event types external producers declare for an organization. A declaration replaces everything its source
 * declared before. Each type starts with its source and a dot, so a producer can neither take another's types nor
 * an in-process one.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class ExternalEvents {

    /** One field of an event's payload; {@code type} is string, number, boolean, datetime, array or object. */
    public record FieldDeclaration(String name, String label, String description, String type) {
    }

    /** @param contextKind null takes the declaration's */
    public record TypeDeclaration(String type, String description, String contextKind,
            List<FieldDeclaration> fields) {
    }

    public record Declaration(String source, String contextKind, List<TypeDeclaration> types) {
    }

    static final int MAX_TYPES = 200;
    static final int MAX_FIELDS = 100;
    private static final Pattern SOURCE = Pattern.compile("[a-z][a-z0-9_-]{1,63}");
    private static final Pattern TYPE_SUFFIX = Pattern.compile("[a-z0-9_]+(\\.[a-z0-9_]+)*");
    private static final Pattern CONTEXT_KIND = Pattern.compile("[a-z][a-z0-9_]{0,31}");
    private static final Pattern FIELD = Pattern.compile("[A-Za-z_]\\w{0,63}");
    private static final Set<String> FIELD_TYPES = Set.of("string", "number", "boolean", "datetime", "array",
            "object");

    private final ExternalEventStore store;
    private final Supplier<List<EventTypeCatalog>> catalogs;
    private final Clock clock;

    @Inject
    ExternalEvents(ExternalEventStore store, Instance<EventTypeCatalog> catalogs) {
        this(store, () -> catalogs.stream().toList(), Clock.systemUTC());
    }

    public ExternalEvents(ExternalEventStore store, Supplier<List<EventTypeCatalog>> catalogs, Clock clock) {
        this.store = store;
        this.catalogs = catalogs;
        this.clock = clock;
    }

    /**
     * Replaces the source's types for the organization.
     *
     * @throws IllegalArgumentException when the declaration is not valid; nothing is stored then
     */
    public List<ExternalEventType> declare(String tenantCode, Declaration d) {
        if (d == null || d.source() == null || !SOURCE.matcher(d.source()).matches()) {
            throw new IllegalArgumentException("source: lowercase letters, digits, - and _ (2 to 64)");
        }
        String source = d.source();
        List<TypeDeclaration> types = d.types() == null ? List.of() : d.types();
        if (types.size() > MAX_TYPES) {
            throw new IllegalArgumentException("At most " + MAX_TYPES + " event types per source");
        }
        Set<String> builtIn = new HashSet<>();
        catalogs.get().forEach(c -> c.types().forEach(t -> builtIn.add(t.type())));
        Set<String> others = new HashSet<>();
        store.list(tenantCode).stream().filter(t -> !source.equals(t.source())).forEach(t -> others.add(t.type()));
        Set<String> seen = new HashSet<>();
        List<ExternalEventType> out = new ArrayList<>();
        for (TypeDeclaration t : types) {
            String type = t == null ? null : t.type();
            if (type == null || !type.startsWith(source + ".") || type.length() > 128
                    || !TYPE_SUFFIX.matcher(type.substring(source.length() + 1)).matches()) {
                throw new IllegalArgumentException("type " + type + ": must be " + source
                        + ".<lowercase words separated by dots>, up to 128 characters");
            }
            if (!seen.add(type)) {
                throw new IllegalArgumentException("type " + type + " is declared twice");
            }
            if (builtIn.contains(type) || others.contains(type)) {
                throw new IllegalArgumentException("type " + type + " belongs to another producer");
            }
            String kind = t.contextKind() != null ? t.contextKind() : d.contextKind();
            if (kind != null && !CONTEXT_KIND.matcher(kind).matches()) {
                throw new IllegalArgumentException("contextKind " + kind + ": lowercase letters, digits and _");
            }
            out.add(new ExternalEventType(tenantCode, source, type, kind, t.description(), fields(type, t.fields()),
                    clock.instant()));
        }
        store.replace(tenantCode, source, out);
        return out;
    }

    public List<ExternalEventType> list(String tenantCode) {
        return store.list(tenantCode);
    }

    public Optional<ExternalEventType> find(String tenantCode, String type) {
        return type == null ? Optional.empty()
                : store.list(tenantCode).stream().filter(t -> type.equals(t.type())).findFirst();
    }

    /** The organization's declared types as the event catalog lists them. */
    public List<EventCatalog.EventTypeView> views(String tenantCode) {
        return store.list(tenantCode).stream().map(ExternalEventType::view).toList();
    }

    private static List<EventCatalog.Field> fields(String type, List<FieldDeclaration> fields) {
        List<FieldDeclaration> in = fields == null ? List.of() : fields;
        if (in.size() > MAX_FIELDS) {
            throw new IllegalArgumentException("type " + type + ": at most " + MAX_FIELDS + " fields");
        }
        Set<String> seen = new HashSet<>();
        List<EventCatalog.Field> out = new ArrayList<>();
        for (FieldDeclaration f : in) {
            if (f == null || f.name() == null || !FIELD.matcher(f.name()).matches() || !seen.add(f.name())) {
                throw new IllegalArgumentException("type " + type + ": each field needs a distinct name, "
                        + "letters, digits and _");
            }
            String fieldType = f.type() == null ? "string" : f.type();
            if (!FIELD_TYPES.contains(fieldType)) {
                throw new IllegalArgumentException("type " + type + ", field " + f.name() + ": type is one of "
                        + FIELD_TYPES);
            }
            String label = f.label() == null || f.label().isBlank() ? f.name() : f.label();
            out.add(new EventCatalog.Field(f.name(), label, f.description(), fieldType));
        }
        return out;
    }
}

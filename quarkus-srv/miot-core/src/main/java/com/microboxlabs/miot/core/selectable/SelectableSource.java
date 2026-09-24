package com.microboxlabs.miot.core.selectable;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.Map;

/**
 * Where a list's options come from. {@link Kind#STATIC} lists keep their
 * options in the list itself; the others fetch them when a field asks, through
 * the {@link SelectableOptionSource} registered for them.
 *
 * @param ref    for SYSTEM, the source id (such as {@code core.timezones}); for CONNECTION, the connection id
 * @param config source-specific settings, such as the request path and which fields hold the value and label
 */
public record SelectableSource(Kind kind, String ref, Map<String, Object> config) {

    public enum Kind {
        STATIC,
        SYSTEM,
        CONNECTION
    }

    public static final SelectableSource STATIC = new SelectableSource(Kind.STATIC, null, Map.of());

    public static SelectableSource system(String sourceId) {
        return new SelectableSource(Kind.SYSTEM, sourceId, Map.of());
    }

    @JsonIgnore
    public boolean isStatic() {
        return kind == Kind.STATIC;
    }
}

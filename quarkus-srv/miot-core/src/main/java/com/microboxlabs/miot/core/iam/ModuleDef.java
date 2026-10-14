package com.microboxlabs.miot.core.iam;

import java.util.Map;
import java.util.Objects;

/**
 * A module as shown on the Team pages: its name and what it is for, per language. {@code ai} marks assistant
 * modules, which the app shows with the AI accent.
 */
public record ModuleDef(String key, Map<String, String> label, Map<String, String> description, boolean ai) {

    public ModuleDef {
        Objects.requireNonNull(key, "key");
        label = label == null ? Map.of() : Map.copyOf(label);
        description = description == null ? Map.of() : Map.copyOf(description);
    }

    public static ModuleDef of(String key, String es, String en, String descriptionEs, String descriptionEn) {
        return new ModuleDef(key, Map.of("es", es, "en", en), Map.of("es", descriptionEs, "en", descriptionEn), false);
    }

    public ModuleDef asAi() {
        return new ModuleDef(key, label, description, true);
    }
}

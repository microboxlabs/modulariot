package com.microboxlabs.miot.core.selectable;

import java.util.Map;

/** A heading options can sit under, like an HTML {@code optgroup}. */
public record SelectableGroup(String key, Map<String, String> label) {

    public static SelectableGroup of(String key, String es, String en) {
        return new SelectableGroup(key, Localized.of(es, en));
    }
}

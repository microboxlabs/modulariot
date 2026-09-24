package com.microboxlabs.miot.core.selectable;

import java.util.Map;

/**
 * How a field backed by the list behaves.
 *
 * @param searchable    the field offers a search box; null means yes
 * @param creatable     people may type a value that is not in the list (tags); null means no
 * @param dependsOn     key of the list whose selection filters this one by {@link SelectableOption#parent()}
 * @param maxSelections cap for {@link SelectionMode#MULTIPLE}; null means none
 * @param placeholder   text shown while nothing is selected, per language
 */
public record SelectableSettings(
        Boolean searchable,
        Boolean creatable,
        String dependsOn,
        Integer maxSelections,
        Map<String, String> placeholder) {

    public static final SelectableSettings DEFAULT = new SelectableSettings(true, false, null, null, Map.of());

    public static SelectableSettings tags() {
        return new SelectableSettings(true, true, null, null, Map.of());
    }

    public static SelectableSettings dependingOn(String listKey) {
        return new SelectableSettings(true, false, listKey, null, Map.of());
    }
}

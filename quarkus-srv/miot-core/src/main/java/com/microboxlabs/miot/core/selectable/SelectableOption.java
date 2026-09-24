package com.microboxlabs.miot.core.selectable;

import java.util.Map;

/**
 * One choice in a list. {@code value} is the stable code records store; the
 * label is what people see, per language.
 *
 * @param group    key of one of the list's {@link SelectableGroup}s, or null
 * @param color    a badge color name, such as {@code green} or {@code red}, or null
 * @param icon     an icon name the app knows, such as {@code truck}, or null
 * @param parent   value of the option in the {@code dependsOn} list this one belongs under, or null
 * @param disabled shown but not selectable
 */
public record SelectableOption(
        String value,
        Map<String, String> label,
        Map<String, String> description,
        String group,
        String color,
        String icon,
        String parent,
        boolean disabled) {

    public static SelectableOption of(String value, String es, String en) {
        return new SelectableOption(value, Localized.of(es, en), Map.of(), null, null, null, null, false);
    }

    public SelectableOption withGroup(String groupKey) {
        return new SelectableOption(value, label, description, groupKey, color, icon, parent, disabled);
    }

    public SelectableOption withLook(String colorName, String iconName) {
        return new SelectableOption(value, label, description, group, colorName, iconName, parent, disabled);
    }

    public SelectableOption withParent(String parentValue) {
        return new SelectableOption(value, label, description, group, color, icon, parentValue, disabled);
    }

    public SelectableOption withDescription(String es, String en) {
        return new SelectableOption(value, label, Localized.of(es, en), group, color, icon, parent, disabled);
    }

    public SelectableOption asDisabled() {
        return new SelectableOption(value, label, description, group, color, icon, parent, true);
    }
}

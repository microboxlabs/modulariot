package com.microboxlabs.miot.core.selectable;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * What a list must look like before it is stored. Every method returns the
 * cleaned value, or throws {@link IllegalArgumentException} with a message fit
 * for a 400.
 */
final class SelectableRules {

    static final Pattern KEY = Pattern.compile("^[a-z][a-z0-9_]{1,63}$");
    private static final Pattern VALUE = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$");
    private static final Pattern ICON = Pattern.compile("^[a-z0-9-]{1,40}$");
    /** Flowbite badge colors. */
    static final Set<String> COLORS = Set.of(
            "gray", "blue", "green", "red", "yellow", "indigo", "purple", "pink", "cyan", "teal", "lime");
    private static final int MAX_SLUG = 60;

    private SelectableRules() {
    }

    static void validateKey(String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("key must match [a-z][a-z0-9_]{1,63}: " + key);
        }
    }

    /**
     * @param ownKey    the list being written, which cannot depend on itself
     * @param knownKeys the tenant's lists, one of which {@code dependsOn} must name
     */
    static SelectableSettings settings(SelectableSettings given, SelectionMode mode, String ownKey,
            Set<String> knownKeys) {
        if (given == null) {
            return SelectableSettings.DEFAULT;
        }
        String dependsOn = blankToNull(given.dependsOn());
        if (dependsOn != null) {
            validateKey(dependsOn);
            if (dependsOn.equals(ownKey) || !knownKeys.contains(dependsOn)) {
                throw new IllegalArgumentException("dependsOn must name another existing list: " + dependsOn);
            }
        }
        Integer max = mode == SelectionMode.MULTIPLE ? given.maxSelections() : null;
        if (max != null && max < 1) {
            throw new IllegalArgumentException("maxSelections must be at least 1");
        }
        return new SelectableSettings(
                given.searchable() == null || given.searchable(),
                Boolean.TRUE.equals(given.creatable()),
                dependsOn,
                max,
                Localized.clean(given.placeholder(), "placeholder"));
    }

    static List<SelectableGroup> groups(List<SelectableGroup> given) {
        List<SelectableGroup> out = new ArrayList<>();
        Set<String> keys = new HashSet<>();
        for (SelectableGroup g : given == null ? List.<SelectableGroup>of() : given) {
            if (g == null) {
                throw new IllegalArgumentException("a group cannot be empty");
            }
            validateKey(g.key());
            if (!keys.add(g.key())) {
                throw new IllegalArgumentException("duplicate group: " + g.key());
            }
            out.add(new SelectableGroup(g.key(), Localized.required(g.label(), "group label")));
        }
        return out;
    }

    static SelectableSource source(SelectableSource given) {
        if (given == null || given.kind() == null || given.isStatic()) {
            return SelectableSource.STATIC;
        }
        String ref = blankToNull(given.ref());
        if (ref == null) {
            throw new IllegalArgumentException("a " + given.kind() + " source needs a ref");
        }
        return new SelectableSource(given.kind(), ref, given.config() == null ? Map.of() : given.config());
    }

    /**
     * Gives options without a value one made from the label, and rejects
     * duplicate values and references to groups the list does not have.
     */
    static List<SelectableOption> options(List<SelectableOption> given, List<SelectableGroup> groups,
            SelectableSettings settings) {
        Set<String> groupKeys = new HashSet<>();
        groups.forEach(g -> groupKeys.add(g.key()));
        Set<String> values = new HashSet<>();
        List<SelectableOption> out = new ArrayList<>();
        for (SelectableOption o : given == null ? List.<SelectableOption>of() : given) {
            if (o == null) {
                throw new IllegalArgumentException("an option cannot be empty");
            }
            Map<String, String> label = Localized.required(o.label(), "option label");
            String value = blankToNull(o.value()) == null
                    ? uniqueSlug(Localized.preferred(label), values)
                    : o.value().trim();
            if (!VALUE.matcher(value).matches()) {
                throw new IllegalArgumentException("option value must match [A-Za-z0-9][A-Za-z0-9_.:-]*: " + value);
            }
            if (!values.add(value)) {
                throw new IllegalArgumentException("duplicate option value: " + value);
            }
            out.add(new SelectableOption(value, label, Localized.clean(o.description(), "option description"),
                    group(o.group(), groupKeys), color(o.color()), icon(o.icon()), parent(o.parent(), settings),
                    o.disabled()));
        }
        return out;
    }

    /** Lower case, accents dropped, runs of anything else turned into one underscore. */
    static String slug(String text) {
        String plain = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        StringBuilder out = new StringBuilder();
        for (char c : plain.toCharArray()) {
            boolean alnum = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
            if (alnum) {
                out.append(c);
            } else if (!out.isEmpty() && out.charAt(out.length() - 1) != '_') {
                out.append('_');
            }
            if (out.length() >= MAX_SLUG) {
                break;
            }
        }
        while (!out.isEmpty() && out.charAt(out.length() - 1) == '_') {
            out.setLength(out.length() - 1);
        }
        return out.isEmpty() ? "option" : out.toString();
    }

    private static String uniqueSlug(String label, Set<String> taken) {
        String base = slug(label);
        String candidate = base;
        for (int n = 2; taken.contains(candidate); n++) {
            candidate = base + "_" + n;
        }
        return candidate;
    }

    private static String group(String given, Set<String> groupKeys) {
        String group = blankToNull(given);
        if (group != null && !groupKeys.contains(group)) {
            throw new IllegalArgumentException("unknown group: " + group);
        }
        return group;
    }

    private static String color(String given) {
        String color = blankToNull(given);
        if (color != null && !COLORS.contains(color)) {
            throw new IllegalArgumentException("color must be one of " + COLORS + ": " + color);
        }
        return color;
    }

    private static String icon(String given) {
        String icon = blankToNull(given);
        if (icon != null && !ICON.matcher(icon).matches()) {
            throw new IllegalArgumentException("icon must match [a-z0-9-]{1,40}: " + icon);
        }
        return icon;
    }

    private static String parent(String given, SelectableSettings settings) {
        String parent = blankToNull(given);
        if (parent != null && settings.dependsOn() == null) {
            throw new IllegalArgumentException("an option parent needs settings.dependsOn");
        }
        return parent;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}

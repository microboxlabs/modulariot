package com.microboxlabs.miot.core.selectable;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;

/**
 * Reads default lists from a JSON file on the classpath, so a
 * {@link SelectableDefaults} provider keeps its content out of code. The file
 * is an array of lists in the API's write shape plus {@code key}; omitted
 * settings, groups and source take their defaults. An unknown field fails the
 * read, so a typo breaks the build instead of being dropped.
 */
public final class SelectableDefaultsFile {

    static final String UPDATED_BY = "system:defaults";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TypeReference<List<Entry>> ENTRIES = new TypeReference<>() {
    };

    private SelectableDefaultsFile() {
    }

    /** @param resource absolute classpath path, such as {@code /selectables/defaults/general.json} */
    public static List<Selectable> read(Class<?> owner, String resource) {
        try (InputStream in = owner.getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("default selectables not found: " + resource);
            }
            return JSON.readValue(in, ENTRIES).stream().map(Entry::toSelectable).toList();
        } catch (IOException e) {
            throw new UncheckedIOException("could not read default selectables: " + resource, e);
        }
    }

    @RegisterForReflection
    record Entry(
            String key,
            Map<String, String> name,
            Map<String, String> description,
            SelectionMode mode,
            SelectableSettings settings,
            List<SelectableGroup> groups,
            SelectableSource source,
            List<SelectableOption> options) {

        Selectable toSelectable() {
            return new Selectable(null, key, orEmpty(name), orEmpty(description), mode,
                    settings == null ? SelectableSettings.DEFAULT : withDefaults(settings),
                    groups == null ? List.of() : List.copyOf(groups),
                    source == null ? SelectableSource.STATIC : withDefaults(source),
                    options == null ? List.of() : options.stream().map(Entry::withDefaults).toList(),
                    UPDATED_BY, null);
        }

        private static SelectableSettings withDefaults(SelectableSettings s) {
            return new SelectableSettings(s.searchable() == null || s.searchable(), Boolean.TRUE.equals(s.creatable()),
                    s.dependsOn(), s.maxSelections(), orEmpty(s.placeholder()));
        }

        private static SelectableSource withDefaults(SelectableSource s) {
            return new SelectableSource(s.kind(), s.ref(), s.config() == null ? Map.of() : s.config());
        }

        private static SelectableOption withDefaults(SelectableOption o) {
            return new SelectableOption(o.value(), orEmpty(o.label()), orEmpty(o.description()), o.group(),
                    o.color(), o.icon(), o.parent(), o.disabled());
        }

        private static <K, V> Map<K, V> orEmpty(Map<K, V> map) {
            return map == null ? Map.of() : map;
        }
    }
}

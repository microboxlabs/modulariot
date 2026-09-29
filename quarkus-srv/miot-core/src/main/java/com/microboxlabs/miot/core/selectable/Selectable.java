package com.microboxlabs.miot.core.selectable;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * A named option list an organization can edit, such as the reasons a form
 * field offers. {@code name} and {@code description} are per language, like
 * the option labels.
 */
public record Selectable(
        String tenantCode,
        String key,
        Map<String, String> name,
        Map<String, String> description,
        SelectionMode mode,
        SelectableSettings settings,
        List<SelectableGroup> groups,
        SelectableSource source,
        List<SelectableOption> options,
        String updatedBy,
        OffsetDateTime updatedAt) {

    /** A static list with default settings and no groups, for providers of default lists. */
    public static Selectable of(String key, String nameEs, String nameEn, String descriptionEs,
            String descriptionEn, SelectionMode mode, List<SelectableOption> options) {
        return new Selectable(null, key, Localized.of(nameEs, nameEn), Localized.of(descriptionEs, descriptionEn),
                mode, SelectableSettings.DEFAULT, List.of(), SelectableSource.STATIC, options,
                SelectableDefaultsFile.UPDATED_BY, null);
    }

    public Selectable forTenant(String tenant) {
        return new Selectable(tenant, key, name, description, mode, settings, groups, source, options, updatedBy,
                updatedAt);
    }

    public Selectable withSettings(SelectableSettings next) {
        return new Selectable(tenantCode, key, name, description, mode, next, groups, source, options, updatedBy,
                updatedAt);
    }

    public Selectable withGroups(List<SelectableGroup> next) {
        return new Selectable(tenantCode, key, name, description, mode, settings, next, source, options, updatedBy,
                updatedAt);
    }

    public Selectable withSource(SelectableSource next) {
        return new Selectable(tenantCode, key, name, description, mode, settings, groups, next, options, updatedBy,
                updatedAt);
    }
}

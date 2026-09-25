package com.microboxlabs.miot.core.selectable;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * General-purpose lists every organization starts with, read from
 * {@value #RESOURCE}. Each one also shows a different thing a list can do:
 * colors and icons, groups, tags, a selection cap, a list filtered by another,
 * disabled options, and lists fed by a system source.
 */
@ApplicationScoped
public class GeneralSelectables implements SelectableDefaults {

    static final String RESOURCE = "/selectables/defaults/general.json";

    private final List<Selectable> lists = SelectableDefaultsFile.read(GeneralSelectables.class, RESOURCE);

    @Override
    public List<Selectable> forTenant(String tenantCode) {
        return lists;
    }
}

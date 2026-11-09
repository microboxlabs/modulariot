package com.microboxlabs.miot.core.iam;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Three modules with a legacy-default role, as a modulith with its domain modules has; on for one test profile. */
@ApplicationScoped
@LookupIfProperty(name = LegacyDefaultsTestCatalog.PROPERTY, stringValue = "true")
public class LegacyDefaultsTestCatalog implements AccessCatalog {

    static final String PROPERTY = "miot.test.legacy-defaults-catalog";
    static final List<String> MODULES = List.of("legacya", "legacyb", "legacyc");
    static final String OTHER_ROLE = "LEGACYA_EDITOR";

    @Override
    public List<PermissionDef> permissions() {
        return MODULES.stream().map(m -> PermissionDef.of(m + ":view", "Ver", "View")).toList();
    }

    @Override
    public List<RoleDef> roles() {
        List<RoleDef> roles = new ArrayList<>(MODULES.stream()
                .map(m -> RoleDef.of(viewer(m), m, "Lector", "Viewer", Set.of(m + ":view")).asLegacyDefault())
                .toList());
        roles.add(RoleDef.of(OTHER_ROLE, MODULES.get(0), "Editor", "Editor", Set.of(MODULES.get(0) + ":view")));
        return roles;
    }

    static String viewer(String module) {
        return module.toUpperCase() + "_VIEWER";
    }
}

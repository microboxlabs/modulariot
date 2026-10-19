package com.microboxlabs.miot.core.iam;

import java.util.Map;
import java.util.Objects;

/**
 * One action a principal may take, {@code module:resource.action}. Modules declare them in an {@link AccessCatalog}.
 *
 * @param explicitOnly not part of the Owner and Admin base roles: only a role that names it grants it
 * @param ownerOnly    part of Owner but not Admin
 */
public record PermissionDef(String key, String module, Map<String, String> label, boolean explicitOnly,
        boolean ownerOnly) {

    public PermissionDef {
        Objects.requireNonNull(key, "key");
        if (!key.matches("[a-z][a-z0-9_-]*:[a-z][a-z0-9_.-]*")) {
            throw new IllegalArgumentException("permission key must be module:action, got " + key);
        }
        label = label == null ? Map.of() : Map.copyOf(label);
    }

    public static PermissionDef of(String key, String es, String en) {
        int colon = key == null ? -1 : key.indexOf(':');
        String module = colon > 0 ? key.substring(0, colon) : key;
        return new PermissionDef(key, module, Map.of("es", es, "en", en), false, false);
    }

    public PermissionDef explicit() {
        return new PermissionDef(key, module, label, true, ownerOnly);
    }

    public PermissionDef forOwnersOnly() {
        return new PermissionDef(key, module, label, explicitOnly, true);
    }
}

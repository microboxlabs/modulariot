package com.microboxlabs.miot.core.iam;

import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * A module role: a named set of permissions granted through a role binding. Base roles (Owner, Admin, Member) are
 * not RoleDefs; see {@link BaseRole}.
 *
 * @param legacyDefault granted to members of an organization whose membership comes from Alfresco, and to the
 *                      organization's own M2M client, when they hold no role of this module. Keeps what members could
 *                      do before module roles existed.
 */
public record RoleDef(String key, String module, Map<String, String> label, Set<String> permissions,
        boolean legacyDefault, Map<String, String> description) {

    public RoleDef {
        Objects.requireNonNull(key, "key");
        if (!key.matches("[A-Z][A-Z0-9_]*")) {
            throw new IllegalArgumentException("role key must be UPPER_SNAKE, got " + key);
        }
        label = label == null ? Map.of() : Map.copyOf(label);
        description = description == null ? Map.of() : Map.copyOf(description);
        permissions = Set.copyOf(permissions);
    }

    public static RoleDef of(String key, String module, String es, String en, Set<String> permissions) {
        return new RoleDef(key, module, Map.of("es", es, "en", en), permissions, false, Map.of());
    }

    public RoleDef asLegacyDefault() {
        return new RoleDef(key, module, label, permissions, true, description);
    }

    /** What the role is for, in one sentence per language. */
    public RoleDef describedAs(String es, String en) {
        return new RoleDef(key, module, label, permissions, legacyDefault, Map.of("es", es, "en", en));
    }
}

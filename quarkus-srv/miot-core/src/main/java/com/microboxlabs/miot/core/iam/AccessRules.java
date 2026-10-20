package com.microboxlabs.miot.core.iam;

import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Turns what was loaded about a caller into an {@link Access}. No I/O, so every rule is unit-tested.
 *
 * <ul>
 *   <li>A user needs a membership; its base role is the membership's.</li>
 *   <li>The organization's own M2M client is a Member; so is a service account of the organization.</li>
 *   <li>An M2M client holding no role of a module gets that module's legacy-default role.</li>
 *   <li>A platform owner is Owner of every organization, with or without a membership.</li>
 * </ul>
 */
public final class AccessRules {

    /**
     * Everything the evaluator loaded.
     *
     * @param membershipRole    the caller's base role from a membership of the org or its parent; null for none
     * @param tenantClient      the caller is the organization's own M2M client
     * @param boundRoles        role keys of the bindings that cover the org
     * @param platformOwner     the caller is a platform owner
     */
    public record Facts(BaseRole membershipRole, boolean tenantClient, Set<String> boundRoles,
            boolean platformOwner) {

        public Facts(BaseRole membershipRole, boolean tenantClient, Set<String> boundRoles) {
            this(membershipRole, tenantClient, boundRoles, false);
        }
    }

    private AccessRules() {
    }

    public static Access resolve(Long organizationId, String slug, Caller caller, Facts facts,
            AccessRegistry registry) {
        BaseRole base = baseRole(caller, facts);
        if (base == null) {
            return Access.none(organizationId, slug);
        }
        Set<String> roles = new TreeSet<>(facts.boundRoles());
        if (caller.isClient()) {
            addLegacyDefaults(roles, registry);
        }
        return new Access(organizationId, slug, base, roles, registry.permissionsOf(base, roles));
    }

    static BaseRole baseRole(Caller caller, Facts facts) {
        if (caller.isServiceAccount()) {
            return facts.membershipRole();
        }
        if (caller.isClient()) {
            return facts.tenantClient() ? BaseRole.MEMBER : null;
        }
        if (!caller.isUser()) {
            return null;
        }
        return facts.platformOwner() ? BaseRole.OWNER : facts.membershipRole();
    }

    private static void addLegacyDefaults(Set<String> roles, AccessRegistry registry) {
        for (Map.Entry<String, RoleDef> entry : registry.legacyDefaults().entrySet()) {
            String module = entry.getKey();
            boolean holdsOne = roles.stream()
                    .anyMatch(key -> registry.role(key).map(r -> r.module().equals(module)).orElse(false));
            if (!holdsOne) {
                roles.add(entry.getValue().key());
            }
        }
    }
}

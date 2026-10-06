package com.microboxlabs.miot.core.iam;

import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Turns what was loaded about a caller into an {@link Access}. No I/O, so every rule is unit-tested.
 *
 * <ul>
 *   <li>Native membership: the caller needs a membership; its base role is the membership's.</li>
 *   <li>Alfresco membership: the caller must be in the org's Alfresco group (or the org has none); the base role is
 *       the membership's, else Member, or Owner when no owner is assigned yet and the caller manages the Alfresco
 *       site or group.</li>
 *   <li>The organization's own M2M client is a Member.</li>
 *   <li>Outside native membership, a caller holding no role of a module gets that module's legacy-default role.</li>
 * </ul>
 */
public final class AccessRules {

    /**
     * Everything the evaluator loaded.
     *
     * @param membershipRole    the caller's base role from a membership of the org or its parent; null for none
     * @param directoryMember   Alfresco says the caller is a member, or the org has no Alfresco group
     * @param bootstrapOwner    no owner is assigned and the caller manages the org in Alfresco
     * @param tenantClient      the caller is the organization's own M2M client
     * @param boundRoles        role keys of the bindings that cover the org
     */
    public record Facts(boolean nativeMembership, BaseRole membershipRole, boolean directoryMember,
            boolean bootstrapOwner, boolean tenantClient, Set<String> boundRoles, String alfrescoRole) {
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
        if (!facts.nativeMembership() || caller.isClient()) {
            addLegacyDefaults(roles, registry);
        }
        return new Access(organizationId, slug, base, roles, registry.permissionsOf(base, roles),
                facts.alfrescoRole());
    }

    static BaseRole baseRole(Caller caller, Facts facts) {
        if (caller.isClient()) {
            return facts.tenantClient() ? BaseRole.MEMBER : null;
        }
        if (!caller.isUser()) {
            return null;
        }
        if (facts.nativeMembership()) {
            return facts.membershipRole();
        }
        if (!facts.directoryMember()) {
            return null;
        }
        BaseRole base = BaseRole.max(facts.membershipRole(), BaseRole.MEMBER);
        return facts.bootstrapOwner() ? BaseRole.OWNER : base;
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

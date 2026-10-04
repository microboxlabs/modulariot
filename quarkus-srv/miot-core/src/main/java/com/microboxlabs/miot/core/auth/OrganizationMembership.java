package com.microboxlabs.miot.core.auth;

import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.model.OrganizationRoleAssignment;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Where organization membership comes from, set per deployment by {@value #PROPERTY}:
 *
 * <ul>
 *   <li>{@code alfresco} (default): the organization's Alfresco group.
 *   <li>{@code native}: the modulith's own role assignments. A person is a member when they hold at least one
 *       role in the organization or, for a sub-account, in its parent. No Alfresco is needed.
 * </ul>
 */
@ApplicationScoped
public class OrganizationMembership {

    public static final String PROPERTY = "miot.organizations.membership";
    public static final String NATIVE = "native";

    private final boolean nativeMembership;

    @Inject
    public OrganizationMembership(@ConfigProperty(name = PROPERTY, defaultValue = "alfresco") String membership) {
        this.nativeMembership = NATIVE.equalsIgnoreCase(membership.trim());
    }

    public boolean isNative() {
        return nativeMembership;
    }

    /** The organization that holds roles for {@code organization}: its parent for a sub-account. */
    public static Organization roleOwner(Organization organization) {
        return organization.parent != null ? organization.parent : organization;
    }

    /**
     * The role codes {@code personId} holds in {@code organization}, from the modulith's assignments: its own
     * and, for a sub-account, its parent's.
     */
    public Uni<Set<String>> assignedRoles(Organization organization, String personId) {
        return OrganizationRoleAssignment.findForOrganizations(roleScope(organization))
                .map(assignments -> heldRoles(assignments, personId));
    }

    /** The organizations whose assignments count for {@code organization}: itself, and its parent if any. */
    public static List<Long> roleScope(Organization organization) {
        return organization.parent != null
                ? List.of(organization.id, organization.parent.id)
                : List.of(organization.id);
    }

    /** The role codes among {@code assignments} held by {@code personId}, compared without case. */
    public static Set<String> heldRoles(List<OrganizationRoleAssignment> assignments, String personId) {
        Set<String> held = new TreeSet<>();
        if (personId == null || personId.isBlank()) {
            return held;
        }
        String person = personId.trim();
        for (OrganizationRoleAssignment assignment : assignments) {
            if (person.equalsIgnoreCase(assignment.id.personId)) {
                held.add(assignment.id.roleCode);
            }
        }
        return held;
    }
}

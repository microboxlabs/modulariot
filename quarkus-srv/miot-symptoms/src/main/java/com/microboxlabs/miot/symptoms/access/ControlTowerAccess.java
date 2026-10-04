package com.microboxlabs.miot.symptoms.access;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import java.util.EnumSet;
import java.util.Set;

/**
 * The caller's control tower permissions in the organization the request entered. An M2M caller (no
 * email) gets VIEW and OPERATE, as members did before the roles existed.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class ControlTowerAccess {

    private final OrganizationRoleService roles;
    private final OrganizationContext organizationContext;

    @Inject
    public ControlTowerAccess(OrganizationRoleService roles, OrganizationContext organizationContext) {
        this.roles = roles;
        this.organizationContext = organizationContext;
    }

    public Uni<Set<ControlTowerPermission>> permissions(String organizationSlug) {
        String email = organizationContext.getUserEmail();
        if (email == null || email.isBlank()) {
            return Uni.createFrom().item(EnumSet.of(ControlTowerPermission.VIEW, ControlTowerPermission.OPERATE));
        }
        return roles.callerRoles(organizationSlug)
                .map(held -> ControlTowerPermission.granted(held, roles.nativeMembership()));
    }

    /** The caller's role codes, for showing them; none for an M2M caller. */
    public Uni<Set<String>> roles(String organizationSlug) {
        return roles.callerRoles(organizationSlug);
    }

    /** Fails with {@link ForbiddenException} unless the caller has {@code permission}. */
    public Uni<Void> require(String organizationSlug, ControlTowerPermission permission) {
        return permissions(organizationSlug).flatMap(granted -> granted.contains(permission)
                ? Uni.createFrom().voidItem()
                : Uni.createFrom().failure(new ForbiddenException(
                        "Control tower permission required: " + permission)));
    }
}

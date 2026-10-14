package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.Set;
import java.util.TreeSet;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * The caller's control tower permissions, served by the modulith that runs the control tower so the app shows only
 * the actions this backend will allow.
 */
@Path("/api/v1/orgs/{organizationId}/control-tower/access")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Access", description = "The caller's control tower roles and permissions")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgControlTowerAccessResource extends ControlTowerResourceSupport {

    /** {@code baseRole} OWNER, ADMIN or MEMBER; {@code roles} the module roles held; {@code permissions} theirs. */
    public record AccessView(String baseRole, Set<String> roles, Set<String> permissions) {
    }

    @Inject
    public OrgControlTowerAccessResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity) {
        super(tenantContext, organizationContext, roleService, identity);
    }

    @GET
    @Operation(operationId = "getControlTowerAccess",
            summary = "The caller's base role, module roles, and control tower permissions (controltower:*)")
    public Uni<AccessView> get(@PathParam("organizationId") String organizationId) {
        tenantCode(organizationId);
        return access(organizationId).map(access -> {
            Set<String> tower = new TreeSet<>();
            access.permissions().stream()
                    .filter(p -> p.startsWith(ControlTowerAccessCatalog.MODULE + ":"))
                    .forEach(tower::add);
            return new AccessView(access.member() ? access.baseRole().name() : null, access.roles(), tower);
        });
    }
}

package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.access.ControlTowerPermission;
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
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** What the caller may do in the control tower, so the app shows only the actions they can take. */
@Path("/api/v1/orgs/{organizationId}/control-tower/access")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Access", description = "The caller's control tower roles and permissions")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgControlTowerAccessResource extends ControlTowerResourceSupport {

    /** {@code roles} are the organization role codes held; {@code permissions} what they allow. */
    public record AccessView(Set<String> roles, Set<ControlTowerPermission> permissions) {
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
            summary = "The caller's roles in the organization and the control tower permissions they give:"
                    + " VIEW, OPERATE (treat cases, edit contacts), MAINTAIN (catalog, settings)")
    public Uni<AccessView> get(@PathParam("organizationId") String organizationId) {
        tenantCode(organizationId);
        return access().roles(organizationId)
                .flatMap(roles -> access().permissions(organizationId)
                        .map(permissions -> new AccessView(roles, permissions)));
    }
}

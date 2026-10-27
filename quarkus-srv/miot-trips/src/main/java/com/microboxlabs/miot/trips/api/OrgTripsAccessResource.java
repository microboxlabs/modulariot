package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
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
 * The caller's trips permissions, so the app shows only the actions this
 * backend will allow.
 */
@Path("/api/v1/orgs/{organizationId}/trips/access")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Access", description = "The caller's trips roles and permissions")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgTripsAccessResource extends OrgResourceSupport {

    /** {@code baseRole} OWNER, ADMIN or MEMBER; {@code roles} the module roles held; {@code permissions} theirs. */
    public record AccessView(String baseRole, Set<String> roles, Set<String> permissions) {
    }

    @Inject
    public OrgTripsAccessResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity) {
        super(tenantContext, organizationContext, roleService, identity);
    }

    @GET
    @Operation(operationId = "getTripsAccess",
            summary = "The caller's base role, module roles, and trips permissions (trips:*)")
    public Uni<AccessView> get(@PathParam("organizationId") String organizationId) {
        tenantCode(organizationId);
        return access(organizationId).map(access -> {
            Set<String> trips = new TreeSet<>();
            access.permissions().stream()
                    .filter(p -> p.startsWith(TripsAccessCatalog.MODULE + ":"))
                    .forEach(trips::add);
            return new AccessView(access.member() ? access.baseRole().name() : null, access.roles(), trips);
        });
    }
}

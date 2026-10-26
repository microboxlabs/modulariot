package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.service.BoardService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The trips board: planning, dispatch, delivery and finished, each with its lanes. */
@Path("/api/v1/orgs/{organizationId}/trips/board")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Board", description = "The org's trips placed in board lanes")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgTripsBoardResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final BoardService board;

    @Inject
    public OrgTripsBoardResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            BoardService board) {
        super(tenantContext, organizationContext, roleService, identity);
        this.board = board;
    }

    @GET
    @Path("/{view}")
    @Operation(operationId = "getTripsBoard",
            summary = "One board view (planning, dispatch, delivery, finished): its lanes with counts and cards")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> view(@PathParam(ORG) String organizationId, @PathParam("view") String view,
            @QueryParam("q") String q, @QueryParam("from") String from, @QueryParam("to") String to,
            @QueryParam("limit") String limit) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(board.view(tenant, view, q, OrgTripsResource.timestamp(from, "from"),
                OrgTripsResource.timestamp(to, "to"),
                integer(limit, "limit"))).build());
    }

    @GET
    @Path("/sheet/{tripId}")
    @Operation(operationId = "getTripSheet",
            summary = "One trip's page: its card, plan, milestones, monitor transitions and the feed's source row")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = ORG)
    public Uni<Response> sheet(@PathParam(ORG) String organizationId, @PathParam("tripId") String tripId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(board.sheet(tenant, uuid(tripId, "tripId"))).build());
    }
}

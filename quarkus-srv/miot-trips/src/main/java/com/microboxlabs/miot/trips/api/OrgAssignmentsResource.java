package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.dto.AssignmentRequest;
import com.microboxlabs.miot.trips.dto.AssignmentView;
import com.microboxlabs.miot.trips.service.AssignmentService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Resource assignments: who runs the trip, with validity windows — ending one is the truck change. */
@Path("/api/v1/orgs/{organizationId}/trips")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Assignments", description = "Resource validity windows per trip")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgAssignmentsResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";

    private final AssignmentService assignments;

    @Inject
    public OrgAssignmentsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            AssignmentService assignments) {
        super(tenantContext, organizationContext, roleService, identity);
        this.assignments = assignments;
    }

    @GET
    @Path("/trips/{id}/assignments")
    @Operation(operationId = "listAssignments", summary = "The trip's resource history, oldest window first")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> list(@PathParam(ORG) String organizationId, @PathParam("id") String id) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                assignments.listByTrip(tenant, uuid(id, "id")).stream().map(AssignmentView::of).toList())
                .build());
    }

    @POST
    @Path("/trips/{id}/assignments")
    @Operation(operationId = "createAssignment", summary = "Assigns a truck, trailer or driver to the trip")
    @PermissionsAllowed(value = TripsAccessCatalog.ASSIGNMENT_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> create(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            AssignmentRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(AssignmentView.of(assignments.create(tenant, actor, uuid(id, "id"), body))).build());
    }

    @POST
    @Path("/assignments/{assignmentId}/end")
    @Operation(operationId = "endAssignment",
            summary = "Ends the validity window — the truck change; 409 when already ended")
    @PermissionsAllowed(value = TripsAccessCatalog.ASSIGNMENT_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> end(@PathParam(ORG) String organizationId,
            @PathParam("assignmentId") String assignmentId, Map<String, String> body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            OffsetDateTime validTo = null;
            String raw = body == null ? null : body.get("validTo");
            if (raw != null && !raw.isBlank()) {
                try {
                    validTo = OffsetDateTime.parse(raw);
                } catch (DateTimeParseException e) {
                    throw new IllegalArgumentException("validTo must be an ISO-8601 timestamp");
                }
            }
            return Response.ok(AssignmentView.of(assignments.end(tenant, actor,
                    uuid(assignmentId, "assignmentId"), validTo, body == null ? null : body.get("reason"))))
                    .build();
        });
    }
}

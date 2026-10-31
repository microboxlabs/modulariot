package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.dto.StageView;
import com.microboxlabs.miot.trips.service.StageService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Stages: the trip's state timeline — starting one IS the state change. */
@Path("/api/v1/orgs/{organizationId}/trips")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Stages", description = "The state timeline: plan, start, close")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgStagesResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";
    private static final String STAGE_ID = "stageId";

    private final StageService stages;

    @Inject
    public OrgStagesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            StageService stages) {
        super(tenantContext, organizationContext, roleService, identity);
        this.stages = stages;
    }

    @GET
    @Path("/trips/{id}/stages")
    @Operation(operationId = "listStages", summary = "The trip's stages in sequence — the state timeline")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> list(@PathParam(ORG) String organizationId, @PathParam("id") String id) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                stages.listByTrip(tenant, uuid(id, "id")).stream().map(StageView::of).toList()).build());
    }

    @POST
    @Path("/trips/{id}/stages")
    @Operation(operationId = "addStage", summary = "Adds a stage (a stop) at the end of the sequence")
    @PermissionsAllowed(value = TripsAccessCatalog.TRIP_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> add(@PathParam(ORG) String organizationId, @PathParam("id") String id,
            StageRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(StageView.of(stages.add(tenant, actor, uuid(id, "id"), body))).build());
    }

    @PATCH
    @Path("/stages/{stageId}")
    @Operation(operationId = "updateStage", summary = "Re-plans a pending stage (window, location, checklist)")
    @PermissionsAllowed(value = TripsAccessCatalog.TRIP_WRITE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> update(@PathParam(ORG) String organizationId, @PathParam(STAGE_ID) String stageId,
            StageRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(StageView.of(stages.update(tenant, actor, uuid(stageId, STAGE_ID), body)))
                .build());
    }

    @POST
    @Path("/stages/{stageId}/start")
    @Operation(operationId = "startStage",
            summary = "Opens the stage — the state change; 409 while another stage runs")
    @PermissionsAllowed(value = TripsAccessCatalog.STAGE_OPERATE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> start(@PathParam(ORG) String organizationId, @PathParam(STAGE_ID) String stageId) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(StageView.of(stages.start(tenant, actor, uuid(stageId, STAGE_ID))))
                .build());
    }

    @POST
    @Path("/stages/{stageId}/close")
    @Operation(operationId = "closeStage",
            summary = "Closes the stage; moves its cargo, and 'closing' realizes the trip")
    @PermissionsAllowed(value = TripsAccessCatalog.STAGE_OPERATE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> close(@PathParam(ORG) String organizationId, @PathParam(STAGE_ID) String stageId) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(StageView.of(stages.close(tenant, actor, uuid(stageId, STAGE_ID))))
                .build());
    }
}

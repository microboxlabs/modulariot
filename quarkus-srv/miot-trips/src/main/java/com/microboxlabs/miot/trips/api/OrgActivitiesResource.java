package com.microboxlabs.miot.trips.api;

import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.trips.access.TripsAccessCatalog;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.StageActivity;
import com.microboxlabs.miot.trips.dto.ActivityRequest;
import com.microboxlabs.miot.trips.dto.ActivityView;
import com.microboxlabs.miot.trips.dto.CompleteActivityRequest;
import com.microboxlabs.miot.trips.service.AssignmentService;
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
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Activities: the checklist inside a stage; completing one may produce an assignment. */
@Path("/api/v1/orgs/{organizationId}/trips")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Trips — Activities", description = "Stage checklists; completion can create an assignment")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class OrgActivitiesResource extends OrgResourceSupport {

    private static final String ORG = "organizationId";
    private static final String STAGE_ID = "stageId";

    private final StageService stages;
    private final AssignmentService assignments;
    private final Transactions transactions;

    @Inject
    public OrgActivitiesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            StageService stages,
            AssignmentService assignments,
            Transactions transactions) {
        super(tenantContext, organizationContext, roleService, identity);
        this.stages = stages;
        this.assignments = assignments;
        this.transactions = transactions;
    }

    @GET
    @Path("/stages/{stageId}/activities")
    @Operation(operationId = "listActivities", summary = "The stage's checklist in sequence")
    @PermissionsAllowed(value = TripsAccessCatalog.VIEW, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> list(@PathParam(ORG) String organizationId, @PathParam(STAGE_ID) String stageId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(
                stages.listActivities(tenant, uuid(stageId, STAGE_ID)).stream().map(ActivityView::of).toList())
                .build());
    }

    @POST
    @Path("/stages/{stageId}/activities")
    @Operation(operationId = "addActivity", summary = "Adds an activity to the stage")
    @PermissionsAllowed(value = TripsAccessCatalog.STAGE_OPERATE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> add(@PathParam(ORG) String organizationId, @PathParam(STAGE_ID) String stageId,
            ActivityRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.status(Response.Status.CREATED)
                .entity(ActivityView.of(stages.addActivity(tenant, actor, uuid(stageId, STAGE_ID), body)))
                .build());
    }

    @PATCH
    @Path("/activities/{activityId}")
    @Operation(operationId = "updateActivity", summary = "Patches status, assignee or evidence")
    @PermissionsAllowed(value = TripsAccessCatalog.STAGE_OPERATE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> update(@PathParam(ORG) String organizationId,
            @PathParam("activityId") String activityId, ActivityRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(
                ActivityView.of(stages.updateActivity(tenant, actor, uuid(activityId, "activityId"), body)))
                .build());
    }

    @POST
    @Path("/activities/{activityId}/complete")
    @Operation(operationId = "completeActivity",
            summary = "Completes; an assignment in the body is created and tied to the activity")
    // it may create an assignment, so it needs that permission too
    @PermissionsAllowed(value = {TripsAccessCatalog.STAGE_OPERATE, TripsAccessCatalog.ASSIGNMENT_WRITE},
            inclusive = true, permission = OrgPermission.class, params = "organizationId")
    public Uni<Response> complete(@PathParam(ORG) String organizationId,
            @PathParam("activityId") String activityId, CompleteActivityRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> {
            UUID id = uuid(activityId, "activityId");
            String evidence = body == null || body.evidence() == null ? null : body.evidence().toString();
            Stage stage = body == null || body.assignment() == null ? null
                    : stages.get(tenant, uuid(stages.getActivity(tenant, id).stageId(), STAGE_ID));
            if (stage != null && !Stage.SUBJECT_TRIP.equals(stage.subjectType())) {
                throw new IllegalArgumentException("only a trip stage can produce an assignment");
            }
            // one transaction: when the completion is refused (already done), the assignment is rolled back
            StageActivity done = transactions.inTransaction(() -> {
                String assignmentId = null;
                if (stage != null) {
                    Assignment created = assignments.create(tenant, actor,
                            uuid(stage.subjectId(), "subjectId"), body.assignment());
                    assignmentId = created.id();
                }
                return stages.completeActivity(tenant, actor, id, evidence, assignmentId);
            });
            return Response.ok(ActivityView.of(done)).build();
        });
    }
}

package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.dto.AddActionRequest;
import com.microboxlabs.miot.symptoms.dto.CloseTreatmentRequest;
import com.microboxlabs.miot.symptoms.dto.OpenTreatmentRequest;
import com.microboxlabs.miot.symptoms.service.TreatmentService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Treatment episodes. Opening and closing an episode also writes the legacy
 * StreamHub treatment row so the engine and the older views stay in step.
 */
@Path(ControlTowerResourceSupport.BASE_PATH)
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Treatments", description = "What operators do about a symptom: calls, ignore, invalidate")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgControlTowerTreatmentsResource extends ControlTowerResourceSupport {

    private final TreatmentService treatments;

    @Inject
    public OrgControlTowerTreatmentsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            TreatmentService treatments) {
        super(tenantContext, organizationContext, roleService, identity);
        this.treatments = treatments;
    }

    @GET
    @Path("/symptoms/{symptomId}/treatments")
    @Operation(operationId = "listSymptomTreatments", summary = "Treatments of one symptom",
            description = "Episodes recorded through this API, plus (by default) rows the older tower wrote directly into StreamHub.")
    public Uni<Response> listForSymptom(
            @PathParam("organizationId") String organizationId,
            @PathParam("symptomId") String symptomId,
            @DefaultValue("true") @QueryParam("includeLegacy") boolean includeLegacy) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(
                treatments.listForSymptom(tenant, parseSymptomId(symptomId), includeLegacy)).build());
    }

    @POST
    @Path("/symptoms/{symptomId}/treatments")
    @Operation(operationId = "openTreatment", summary = "Open a treatment on a symptom",
            description = "Returns 201 with the new episode, or 200 with the existing one when the Idempotency-Key (or body idempotencyKey) was already used.")
    public Uni<Response> open(
            @PathParam("organizationId") String organizationId,
            @PathParam("symptomId") String symptomId,
            @Parameter(description = "Client-chosen key to make the open retry-safe") @HeaderParam("Idempotency-Key") String idempotencyKey,
            OpenTreatmentRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return memberWork(() -> {
            OpenTreatmentRequest req = body == null
                    ? new OpenTreatmentRequest(null, null, null, null, idempotencyKey)
                    : new OpenTreatmentRequest(body.type(), body.assetId(), body.tripId(), body.note(),
                            body.idempotencyKey() == null ? idempotencyKey : body.idempotencyKey());
            TreatmentService.OpenResult result = treatments.open(tenant, actor, parseSymptomId(symptomId), req);
            return Response.status(result.created() ? Response.Status.CREATED : Response.Status.OK)
                    .entity(result.treatment())
                    .build();
        });
    }

    @GET
    @Path("/treatments/{treatmentId}")
    @Operation(operationId = "getTreatment", summary = "Get a treatment with its actions")
    public Uni<Response> get(
            @PathParam("organizationId") String organizationId,
            @PathParam("treatmentId") String treatmentId) {
        String tenant = tenantCode(organizationId);
        return memberWork(() -> Response.ok(treatments.get(tenant, treatmentId)).build());
    }

    @POST
    @Path("/treatments/{treatmentId}/actions")
    @Operation(operationId = "addTreatmentAction", summary = "Append an action to an open treatment",
            description = "A call attempt (who, how, outcome, duration, note, tags), the ignore or invalidate decision with its reason, or a note.")
    public Uni<Response> addAction(
            @PathParam("organizationId") String organizationId,
            @PathParam("treatmentId") String treatmentId,
            AddActionRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return memberWork(() -> Response.status(Response.Status.CREATED)
                .entity(treatments.addAction(tenant, actor, treatmentId, body))
                .build());
    }

    @POST
    @Path("/treatments/{treatmentId}/close")
    @Operation(operationId = "closeTreatment", summary = "Finish a treatment",
            description = "Marks the episode CLOSED and writes the summary onto the legacy StreamHub row.")
    public Uni<Response> close(
            @PathParam("organizationId") String organizationId,
            @PathParam("treatmentId") String treatmentId,
            CloseTreatmentRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return memberWork(() -> Response.ok(treatments.close(tenant, actor, treatmentId, body)).build());
    }

    @POST
    @Path("/treatments/{treatmentId}/cancel")
    @Operation(operationId = "cancelTreatment", summary = "Abandon an open treatment",
            description = "For a form that was opened and then dismissed. The legacy row is left for the engine to expire.")
    public Uni<Response> cancel(
            @PathParam("organizationId") String organizationId,
            @PathParam("treatmentId") String treatmentId,
            Map<String, String> body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        String reason = body == null ? null : body.get("reason");
        return memberWork(() -> Response.ok(treatments.cancel(tenant, actor, treatmentId, reason)).build());
    }
}

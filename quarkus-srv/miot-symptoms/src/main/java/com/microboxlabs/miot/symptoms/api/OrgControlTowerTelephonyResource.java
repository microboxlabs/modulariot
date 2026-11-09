package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.OrgPermission;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.symptoms.access.ControlTowerAccessCatalog;
import com.microboxlabs.miot.symptoms.service.TeamsCallReconciler;
import com.microboxlabs.miot.symptoms.service.TelephonyChoiceService;
import com.microboxlabs.miot.core.telephony.TelephonyUnavailableException;
import com.microboxlabs.miot.symptoms.service.TelephonyChoiceService.CallEnded;
import com.microboxlabs.miot.symptoms.service.TelephonyChoiceService.CallRequest;
import com.microboxlabs.miot.symptoms.service.TelephonyChoiceService.TelephonyRequest;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Which telephony connection the treatment's calls use. VIEW reads; SETTINGS_UPDATE chooses. */
@Path("/api/v1/orgs/{organizationId}/control-tower/telephony")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Control Tower — Telephony", description = "The telephony connection used for calls")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class OrgControlTowerTelephonyResource extends ControlTowerResourceSupport {

    private static final String ORG = "organizationId";

    private final TelephonyChoiceService telephony;
    private final TeamsCallReconciler reconciler;

    @Inject
    public OrgControlTowerTelephonyResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            TelephonyChoiceService telephony,
            TeamsCallReconciler reconciler) {
        super(tenantContext, organizationContext, roleService, identity);
        this.telephony = telephony;
        this.reconciler = reconciler;
    }

    @GET
    @Operation(operationId = "getTelephony",
            summary = "The organization's telephony lines, its choice, and the line calls use now (null: none)")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> get(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(telephony.get(tenant)).build());
    }

    @PUT
    @Operation(operationId = "saveTelephony",
            summary = "Choose the provider: TEAMS_PHONE or TELNYX; null lets the server pick (Telnyx first)")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.SETTINGS_UPDATE, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> save(@PathParam(ORG) String organizationId, TelephonyRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return work(() -> Response.ok(telephony.save(tenant, actor, body)).build());
    }

    @POST
    @Path("/webrtc-token")
    @Operation(operationId = "issueTelnyxWebRtcToken",
            summary = "A Telnyx WebRTC login for the signed-in operator, valid 24 hours; 409 when calls do not use"
                    + " Telnyx")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.CASE_TREAT, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> webRtcToken(@PathParam(ORG) String organizationId, CallRequest body) {
        String tenant = tenantCode(organizationId);
        String actor = operator();
        return work(() -> token(() -> telephony.webRtcToken(tenant, actor, body)));
    }

    private static Response token(java.util.function.Supplier<Object> issue) {
        try {
            return Response.ok(issue.get()).header("Cache-Control", "no-store").build();
        } catch (TelephonyUnavailableException e) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("error", e.getMessage(), "code", e.code())).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", e.getMessage())).build();
        }
    }

    @GET
    @Path("/calls/{callRef}")
    @Operation(operationId = "telephonyCallOutcome",
            summary = "Why the provider ended the call before it connected: failure whatsapp_no_permission when the"
                    + " contact has not allowed WhatsApp calls; null otherwise")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> callOutcome(@PathParam(ORG) String organizationId, @PathParam("callRef") String callRef) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(telephony.outcome(tenant, callRef)).header("Cache-Control", "no-store").build());
    }

    @GET
    @Path("/whatsapp-calls")
    @Operation(operationId = "ringingWhatsAppCalls",
            summary = "WhatsApp calls from contacts ringing in the tower, oldest first")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.VIEW, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> ringingWhatsAppCalls(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(telephony.ringingWhatsAppCalls(tenant)).header("Cache-Control", "no-store")
                .build());
    }

    @POST
    @Path("/whatsapp-calls/{callId}/answer")
    @Operation(operationId = "answerWhatsAppCall",
            summary = "A Telnyx WebRTC login to take a ringing WhatsApp call; the operator's call is bridged to it."
                    + " 409 whatsapp_call_taken when another operator took it or it ended")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.CASE_TREAT, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> answerWhatsAppCall(@PathParam(ORG) String organizationId,
            @PathParam("callId") String callId) {
        String tenant = tenantCode(organizationId);
        String actor = operator();
        return work(() -> token(() -> telephony.answerWhatsAppCall(tenant, actor, callId)));
    }

    @POST
    @Path("/calls/{callRef}/ended")
    @Operation(operationId = "telephonyCallEnded",
            summary = "The browser's call ended: frees its channel; the billed seconds come from Telnyx")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.CASE_TREAT, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> callEnded(@PathParam(ORG) String organizationId, @PathParam("callRef") String callRef,
            CallEnded body) {
        String tenant = tenantCode(organizationId);
        operator();
        return work(() -> {
            telephony.callEnded(tenant, callRef, body);
            return Response.noContent().build();
        });
    }

    @POST
    @Path("/reconcile")
    @Operation(operationId = "reconcileTeamsCalls",
            summary = "Fill the signed-in operator's pending Teams calls from the Graph PSTN records; records arrive"
                    + " late, so call again a few minutes later")
    @PermissionsAllowed(value = ControlTowerAccessCatalog.CASE_TREAT, permission = OrgPermission.class,
            params = "organizationId")
    public Uni<Response> reconcile(@PathParam(ORG) String organizationId) {
        String tenant = tenantCode(organizationId);
        String actor = operator();
        return work(() -> Response.ok(reconciler.reconcile(tenant, actor)).build());
    }

    private String operator() {
        var caller = caller();
        if (!caller.isUser()) {
            throw new ForbiddenException("A signed-in operator is required for telephony");
        }
        return caller.email();
    }
}

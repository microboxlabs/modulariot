package com.microboxlabs.miot.conversational.api;

import com.microboxlabs.miot.conversational.calling.CallPermissionService;
import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Whether the organization's WhatsApp number may call a contact, and a request for that permission sent now. A
 * refused request answers 200 with {@code sent: false} and the reason.
 */
@Path("/api/v1/orgs/{organizationId}/conversations/whatsapp-call-permissions")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Conversations", description = "Conversation rules, templates, events and runs")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class OrgWhatsAppCallPermissionsResource extends OrgResourceSupport {

    /** {@code name} fills the template's {@code nombre}; optional. */
    public record RequestBody(String phone, String name) {
    }

    private final CallPermissionService permissions;

    @Inject
    public OrgWhatsAppCallPermissionsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            CallPermissionService permissions) {
        super(tenantContext, organizationContext, roleService, identity);
        this.permissions = permissions;
    }

    @GET
    @Operation(operationId = "getWhatsAppCallPermission",
            summary = "The contact's call permission on the organization's WhatsApp number, and whether a request"
                    + " may be sent now")
    public Uni<Response> get(@PathParam("organizationId") String organizationId, @QueryParam("phone") String phone) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(permissions.view(tenant, phone)).build());
    }

    @POST
    @Path("/requests")
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(operationId = "requestWhatsAppCallPermission",
            summary = "Sends the call permission request now; refused when calling is off, the contact already"
                    + " allows calls, or Meta's limits (1 per day, 2 per week) are reached")
    public Uni<Response> request(@PathParam("organizationId") String organizationId, RequestBody body) {
        String tenant = tenantCode(organizationId);
        String who = actor();
        return work(() -> Response.ok(permissions.request(tenant, body == null ? null : body.phone(),
                body == null ? null : body.name(), who)).build());
    }
}

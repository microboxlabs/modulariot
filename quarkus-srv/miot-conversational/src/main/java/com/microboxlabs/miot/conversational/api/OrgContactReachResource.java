package com.microboxlabs.miot.conversational.api;

import com.microboxlabs.miot.conversational.rules.ContactReach;
import com.microboxlabs.miot.core.api.OrgResourceSupport;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
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
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** The rules in force that write to each contact of the book, for the contact book's cards. */
@Path("/api/v1/orgs/{organizationId}/conversations/contact-reach")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Conversations", description = "Conversation rules, templates, events and runs")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class OrgContactReachResource extends OrgResourceSupport {

    private final ContactReach reach;

    @Inject
    public OrgContactReachResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            ContactReach reach) {
        super(tenantContext, organizationContext, roleService, identity);
        this.reach = reach;
    }

    @GET
    @Operation(operationId = "listConversationContactReach",
            summary = "Contact id to the rules in force that write to it; always is false when it depends on"
                    + " the event")
    public Uni<Response> list(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(reach.byContact(tenant)).build());
    }
}

package com.microboxlabs.miot.conversational.api;

import com.microboxlabs.miot.conversational.rules.RuleFamilies;
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

/** The families a communication rule can belong to, from Ajustes › Seleccionables › Familias de comunicaciones. */
@Path("/api/v1/orgs/{organizationId}/conversations/rule-families")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Conversations", description = "Conversation rules, templates, events and runs")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class OrgRuleFamiliesResource extends OrgResourceSupport {

    private final RuleFamilies families;

    @Inject
    public OrgRuleFamiliesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity,
            RuleFamilies families) {
        super(tenantContext, organizationContext, roleService, identity);
        this.families = families;
    }

    @GET
    @Operation(operationId = "listConversationRuleFamilies",
            summary = "The organization's communication rule families: value and label per language;"
                    + " 404 when it has no such list")
    public Uni<Response> list(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return work(() -> Response.ok(families.options(tenant)).build());
    }
}

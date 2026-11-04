package com.microboxlabs.miot.conversational.api;

import com.microboxlabs.miot.conversational.rules.RulePresets;
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

/** The ready-made rules; adding one is a plain {@code POST /rules} with the preset's key, name and spec. */
@Path("/api/v1/orgs/{organizationId}/conversations/rule-presets")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Conversations", description = "Conversation rules, templates, events and runs")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class OrgRulePresetsResource extends OrgResourceSupport {

    @Inject
    public OrgRulePresetsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity) {
        super(tenantContext, organizationContext, roleService, identity);
    }

    @GET
    @Operation(operationId = "listConversationRulePresets", summary = "The ready-made rules, with their spec")
    public Uni<Response> list(@PathParam("organizationId") String organizationId) {
        tenantCode(organizationId);
        return work(() -> Response.ok(RulePresets.all()).build());
    }
}

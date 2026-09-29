package com.microboxlabs.miot.integrations.api;

import static com.microboxlabs.miot.integrations.api.OrgActorRequests.found;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationPermissionDefinition;
import com.microboxlabs.miot.core.permission.OrganizationPermissionService;
import com.microboxlabs.miot.integrations.service.HarnessTranscriptService;
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

/**
 * A past chat of the organization as a compact transcript, which a trainer's
 * learning session reviews. Trainers only.
 */
@Path("/api/v1/orgs/{organizationId}/harness/transcripts")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Harness Threads", description = "Persistent transcripts for the harness chat panel")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgHarnessTranscriptsResource {

    private final HarnessTranscriptService service;
    private final OrganizationPermissionService permissions;
    private final OrgActorRequests requests;

    @Inject
    public OrgHarnessTranscriptsResource(
            HarnessTranscriptService service,
            OrganizationPermissionService permissions,
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            SecurityIdentity identity) {
        this.service = service;
        this.permissions = permissions;
        this.requests = new OrgActorRequests(tenantContext, organizationContext, identity);
    }

    @GET
    @Path("/{ref}")
    @Operation(summary = "A thread the caller can read, by id or share-link token, as a compact transcript")
    public Uni<Response> transcript(
            @PathParam("organizationId") String organizationId,
            @PathParam("ref") String ref) {
        return permissions.requirePermission(organizationId, OrganizationPermissionDefinition.HARNESS_TRAINER)
                .flatMap(allowed -> requests.run(organizationId, (tenant, userId) ->
                        found(service.transcript(tenant, userId, ref), Response.Status.OK, "thread not found")));
    }
}

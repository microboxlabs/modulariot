package com.microboxlabs.miot.integrations.api;

import static com.microboxlabs.miot.integrations.api.OrgActorRequests.found;
import static com.microboxlabs.miot.integrations.api.OrgActorRequests.noContentOr404;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.dto.StoryDtos.CreateLinkRequest;
import com.microboxlabs.miot.integrations.service.ShareLinkService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
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
 * Share links to a story or a chat thread. Opening one needs only membership
 * of the organization, which the org filter checks for this path.
 */
@Path("/api/v1/orgs/{organizationId}/links")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Share Links", description = "Organization links to stories and chat threads")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgShareLinksResource {

    private static final String NOT_FOUND = "link not found";
    private static final String ORGANIZATION_ID = "organizationId";

    private final ShareLinkService service;
    private final OrgActorRequests requests;

    @Inject
    public OrgShareLinksResource(
            ShareLinkService service,
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            SecurityIdentity identity) {
        this.service = service;
        this.requests = new OrgActorRequests(tenantContext, organizationContext, identity);
    }

    @POST
    @Operation(summary = "Get the link to a story or thread the caller owns, creating it if needed")
    public Uni<Response> createLink(
            @PathParam(ORGANIZATION_ID) String organizationId,
            CreateLinkRequest request) {
        return requests.run(organizationId, (tenant, userId) -> found(
                service.create(organizationId, tenant, userId, request), Response.Status.OK, NOT_FOUND));
    }

    @GET
    @Operation(summary = "List the active links to a story or thread the caller owns")
    public Uni<Response> listLinks(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @QueryParam("targetType") String targetType,
            @QueryParam("targetId") String targetId) {
        return requests.run(organizationId, (tenant, userId) -> found(
                service.list(organizationId, tenant, userId, targetType, targetId).orElse(null),
                Response.Status.OK, NOT_FOUND));
    }

    @GET
    @Path("/{token}")
    @Operation(summary = "Open a link: a read-only snapshot of the story or thread")
    public Uni<Response> resolveLink(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @PathParam("token") String token,
            @QueryParam("after") Long after,
            @QueryParam("limit") Integer limit) {
        return requests.run(organizationId, (tenant, userId) ->
                found(service.resolve(tenant, userId, token, after, limit), Response.Status.OK, NOT_FOUND));
    }

    @DELETE
    @Path("/{token}")
    @Operation(summary = "Revoke a link")
    public Uni<Response> revokeLink(
            @PathParam(ORGANIZATION_ID) String organizationId,
            @PathParam("token") String token) {
        return requests.run(organizationId, (tenant, userId) ->
                noContentOr404(service.revoke(tenant, userId, token), NOT_FOUND));
    }
}

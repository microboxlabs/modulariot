package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.iam.GroupRoles;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Platform owners map a top-level organization's Alfresco groups to module roles and import their members. */
@Path("/api/v1/platform/orgs/{slug}/alfresco-group-roles")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Organizations")
@SecurityRequirement(name = "oidc")
public class PlatformGroupRolesResource {

    /** {@code projected}: keep the role's holders in the group. */
    public record MappingRequest(Boolean projected) {
    }

    private final PlatformAuthorizer authorizer;
    private final GroupRoles groupRoles;

    @Inject
    public PlatformGroupRolesResource(PlatformAuthorizer authorizer, GroupRoles groupRoles) {
        this.authorizer = authorizer;
        this.groupRoles = groupRoles;
    }

    @GET
    @Operation(summary = "The Alfresco groups mapped to module roles")
    public Uni<Response> list(@PathParam("slug") String slug) {
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.ok(() -> groupRoles.list(slug)));
    }

    @PUT
    @Path("/{groupId}/{roleKey}")
    @Operation(summary = "Map an Alfresco group to a module role")
    public Uni<Response> put(@PathParam("slug") String slug, @PathParam("groupId") String groupId,
            @PathParam("roleKey") String roleKey, MappingRequest body) {
        boolean projected = body != null && Boolean.TRUE.equals(body.projected());
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.ok(
                () -> groupRoles.put(slug, groupId, roleKey, projected, actor)));
    }

    @DELETE
    @Path("/{groupId}/{roleKey}")
    @Operation(summary = "Remove a group-to-role mapping; bindings already imported stay")
    public Uni<Response> delete(@PathParam("slug") String slug, @PathParam("groupId") String groupId,
            @PathParam("roleKey") String roleKey) {
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.respond(
                () -> groupRoles.delete(slug, groupId, roleKey, actor), Response.Status.NO_CONTENT));
    }

    @POST
    @Path("/import")
    @Consumes(MediaType.WILDCARD)
    @Operation(summary = "Give each member of every mapped group a binding of the mapped role. dryRun=true reports"
            + " without writing")
    public Uni<Response> importRoles(@PathParam("slug") String slug, @QueryParam("dryRun") boolean dryRun) {
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.ok(
                () -> groupRoles.importRoles(slug, dryRun, actor)));
    }
}

package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.iam.TokenRoles;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** Platform owners map the role ids that sign-in tokens carry to a top-level organization's roles. */
@Path("/api/v1/platform/orgs/{slug}/token-roles")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Organizations")
@SecurityRequirement(name = "oidc")
public class PlatformTokenRolesResource {

    /** {@code roleKey}: a module role, or OWNER, ADMIN or MEMBER for the base role. */
    public record MappingRequest(String roleKey) {
    }

    private final PlatformAuthorizer authorizer;
    private final TokenRoles tokenRoles;

    @Inject
    public PlatformTokenRolesResource(PlatformAuthorizer authorizer, TokenRoles tokenRoles) {
        this.authorizer = authorizer;
        this.tokenRoles = tokenRoles;
    }

    @GET
    @Operation(summary = "The token role ids mapped to roles")
    public Uni<Response> list(@PathParam("slug") String slug) {
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.ok(() -> tokenRoles.list(slug)));
    }

    @PUT
    @Path("/{externalId}")
    @Operation(summary = "Map a token role id to a role")
    public Uni<Response> put(@PathParam("slug") String slug, @PathParam("externalId") String externalId,
            MappingRequest body) {
        String roleKey = body == null ? null : body.roleKey();
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.ok(
                () -> tokenRoles.put(slug, externalId, roleKey, actor)));
    }

    @DELETE
    @Path("/{externalId}")
    @Operation(summary = "Remove a token role id mapping")
    public Uni<Response> delete(@PathParam("slug") String slug, @PathParam("externalId") String externalId) {
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.respond(
                () -> tokenRoles.delete(slug, externalId, actor), Response.Status.NO_CONTENT));
    }
}

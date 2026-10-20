package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.iam.DomainMembership;
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

/** Platform owners set the email domains whose people join a top-level organization at their first sign-in. */
@Path("/api/v1/platform/orgs/{slug}/member-domains")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Organizations")
@SecurityRequirement(name = "oidc")
public class PlatformMemberDomainsResource {

    private final PlatformAuthorizer authorizer;
    private final DomainMembership domains;

    @Inject
    public PlatformMemberDomainsResource(PlatformAuthorizer authorizer, DomainMembership domains) {
        this.authorizer = authorizer;
        this.domains = domains;
    }

    @GET
    @Operation(summary = "The email domains whose people join the organization")
    public Uni<Response> list(@PathParam("slug") String slug) {
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.ok(() -> domains.list(slug)));
    }

    @PUT
    @Path("/{domain}")
    @Operation(summary = "Add an email domain; 409 when another organization has it")
    public Uni<Response> put(@PathParam("slug") String slug, @PathParam("domain") String domain) {
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.ok(
                () -> domains.put(slug, domain, actor)));
    }

    @DELETE
    @Path("/{domain}")
    @Operation(summary = "Remove an email domain; existing members stay")
    public Uni<Response> delete(@PathParam("slug") String slug, @PathParam("domain") String domain) {
        return authorizer.requirePlatformOwner().flatMap(actor -> IamResponses.respond(
                () -> domains.delete(slug, domain, actor), Response.Status.NO_CONTENT));
    }
}

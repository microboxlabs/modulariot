package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.DomainBrandingDto;
import com.microboxlabs.miot.core.api.dto.SetDomainBrandingRequest;
import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.branding.DomainBrandingService;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Per-domain branding administration.
 *
 * <p>Under {@code /api/v1/platform/} rather than {@code /api/v1/orgs/}: a
 * domain belongs to no organization, and that prefix would put the request
 * through {@code OrganizationRequestFilter}'s membership check. Authorization
 * is {@link PlatformAuthorizer} instead, and it denies everything until
 * {@code miot.platform.owner-emails} is set.
 */
@Path("/api/v1/platform/branding/domains")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Branding", description = "Per-domain logo administration")
@SecurityRequirement(name = "oidc")
public class PlatformBrandingResource {

    private static final String DEV_USER_HEADER = "X-Dev-User-Email";

    private final DomainBrandingService service;
    private final PlatformAuthorizer authorizer;

    @Inject
    public PlatformBrandingResource(
            DomainBrandingService service, PlatformAuthorizer authorizer) {
        this.service = service;
        this.authorizer = authorizer;
    }

    @GET
    @Operation(summary = "List every configured domain")
    public Uni<List<DomainBrandingDto>> list(
            @HeaderParam(DEV_USER_HEADER) String devUserEmail) {
        authorizer.requirePlatformOwner(devUserEmail);
        return service.list();
    }

    @GET
    @Path("/{domain}")
    @Operation(summary = "Get one domain's branding")
    public Uni<DomainBrandingDto> get(
            @PathParam("domain") String domain,
            @HeaderParam(DEV_USER_HEADER) String devUserEmail) {
        authorizer.requirePlatformOwner(devUserEmail);
        return service.get(domain);
    }

    @PUT
    @Path("/{domain}")
    @Operation(summary = "Create or replace one domain's branding")
    public Uni<DomainBrandingDto> put(
            @PathParam("domain") String domain,
            @HeaderParam(DEV_USER_HEADER) String devUserEmail,
            SetDomainBrandingRequest request) {
        String callerEmail = authorizer.requirePlatformOwner(devUserEmail);
        return service.upsert(domain, request, callerEmail);
    }

    @DELETE
    @Path("/{domain}")
    @Operation(summary = "Remove one domain's branding, reverting it to the default logo")
    public Uni<Response> delete(
            @PathParam("domain") String domain,
            @HeaderParam(DEV_USER_HEADER) String devUserEmail) {
        authorizer.requirePlatformOwner(devUserEmail);
        return service.delete(domain).replaceWith(Response.noContent().build());
    }
}

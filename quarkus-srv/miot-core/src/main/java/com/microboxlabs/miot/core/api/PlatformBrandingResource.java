package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.DomainBrandingDto;
import com.microboxlabs.miot.core.api.dto.SetDomainBrandingRequest;
import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.branding.DomainBrandingService;
import com.microboxlabs.miot.core.branding.LogoVariant;
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
 * somebody holds {@code PLATFORM_OWNER} — by configuration or by grant.
 */
@Path("/api/v1/platform/branding/domains")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Platform Branding", description = "Per-domain logo administration")
@SecurityRequirement(name = "oidc")
public class PlatformBrandingResource {

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
    public Uni<List<DomainBrandingDto>> list() {
        return authorizer.requirePlatformOwner().flatMap(ignored -> service.list());
    }

    @GET
    @Path("/{domain}")
    @Operation(summary = "Get one domain's branding")
    public Uni<DomainBrandingDto> get(@PathParam("domain") String domain) {
        return authorizer.requirePlatformOwner().flatMap(ignored -> service.get(domain));
    }

    @PUT
    @Path("/{domain}")
    @Operation(summary = "Create or replace one domain's branding")
    public Uni<DomainBrandingDto> put(
            @PathParam("domain") String domain, SetDomainBrandingRequest request) {
        return authorizer.requirePlatformOwner()
                .flatMap(callerEmail -> service.upsert(domain, request, callerEmail));
    }

    /**
     * The stored image, including for a domain that is switched off.
     *
     * <p>Separate from the public {@code /branding/{domain}/logo} because that
     * one serves only active domains: the settings UI has to preview and
     * re-read an inactive one, which deactivating is meant to preserve.
     */
    @GET
    @Path("/{domain}/logo")
    @Produces(MediaType.WILDCARD)
    @Operation(summary = "One domain's stored logo, active or not")
    public Uni<Response> logo(@PathParam("domain") String domain) {
        return serve(domain, LogoVariant.LIGHT);
    }

    @GET
    @Path("/{domain}/logo/dark")
    @Produces(MediaType.WILDCARD)
    @Operation(summary = "One domain's stored dark-background logo, active or not")
    public Uni<Response> darkLogo(@PathParam("domain") String domain) {
        return serve(domain, LogoVariant.DARK);
    }

    private Uni<Response> serve(String domain, LogoVariant variant) {
        return authorizer.requirePlatformOwner()
                .flatMap(ignored -> service.findLogoForOwner(domain, variant))
                .map(logo -> logo == null
                        ? Response.status(Response.Status.NOT_FOUND).build()
                        : Response.ok(logo.content(), logo.mime())
                                // Not cached at all. "private" still permits a
                                // browser store, and a parked domain's logo is
                                // not served publicly — another account on the
                                // same profile could read it back without this
                                // ownership check ever running.
                                .header("Cache-Control", "no-store")
                                .header("X-Content-Type-Options", "nosniff")
                                .header("Content-Security-Policy",
                                        "default-src 'none'; sandbox")
                                .build());
    }

    @DELETE
    @Path("/{domain}")
    @Operation(summary = "Remove one domain's branding, reverting it to the default logo")
    public Uni<Response> delete(@PathParam("domain") String domain) {
        return authorizer.requirePlatformOwner()
                .flatMap(ignored -> service.delete(domain))
                .replaceWith(() -> Response.noContent().build());
    }
}

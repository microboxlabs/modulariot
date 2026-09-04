package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.api.dto.DomainBrandingSummaryDto;
import com.microboxlabs.miot.core.branding.DomainBrandingService;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.EntityTag;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Request;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Public branding lookup, keyed by host.
 *
 * <p>Deliberately outside {@code /api/*}: that prefix carries a blanket
 * {@code authenticated} policy, and a narrower {@code permit} underneath it did
 * not take precedence on Quarkus 3.32.4 — the same reason
 * {@code /webhooks/whatsapp} sits at the root. The matching permit lives in
 * {@code application.properties} under {@code branding}.
 *
 * <p>Unauthenticated because the sign-in page has to render a logo before
 * anyone has logged in. Everything served here is public by definition.
 */
@Path("/branding")
@Tag(name = "Branding", description = "Public per-domain branding")
public class BrandingResource {

    private static final String CACHE_CONTROL =
            "public, max-age=300, stale-while-revalidate=86400";

    private final DomainBrandingService service;

    @Inject
    public BrandingResource(DomainBrandingService service) {
        this.service = service;
    }

    @GET
    @Path("/{domain}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Branding metadata for a domain")
    public Uni<DomainBrandingSummaryDto> summary(@PathParam("domain") String domain) {
        return service.summary(domain);
    }

    @GET
    @Path("/{domain}/logo")
    @Operation(summary = "Logo image for a domain")
    public Uni<Response> logo(
            @PathParam("domain") String domain, @Context Request request) {
        return service.findActiveLogo(domain).map(branding -> {
            if (branding == null) {
                return Response.status(Response.Status.NOT_FOUND).build();
            }
            EntityTag etag = new EntityTag(branding.logoEtag);
            // Non-null means a precondition failed, which for a conditional GET
            // is the 304. Delegated rather than compared by hand: If-None-Match
            // is list-valued and admits weak validators, "*", and commas inside
            // a tag, and the grammar is the container's job to know.
            Response.ResponseBuilder preconditionFailed = request.evaluatePreconditions(etag);
            if (preconditionFailed != null) {
                return withCommonHeaders(preconditionFailed.tag(etag)).build();
            }
            return withCommonHeaders(Response.ok(branding.logoContent, branding.logoMime)
                    .tag(etag)).build();
        });
    }

    /**
     * An uploaded SVG is inert inside an {@code <img>} but not when opened
     * directly, so the response denies it any subresource or script of its own.
     */
    private static Response.ResponseBuilder withCommonHeaders(Response.ResponseBuilder builder) {
        return builder
                .header("Cache-Control", CACHE_CONTROL)
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; sandbox");
    }
}

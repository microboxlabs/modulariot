package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.eclipse.microprofile.rest.client.inject.RestClient;

/**
 * Auth-gated proxy for the caller's starred dashboards. Its own path rather
 * than {@code /dashboards/stars}, so a dashboard called "stars" keeps its
 * address, as with folders.
 */
@Path("/api/v1/orgs/{slug}/dashboard-stars")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Dashboards", description = "Proxy to the dashboard server")
@SecurityRequirement(name = "oidc")
public class DashboardStarProxyResource {

    private final DashboardStarClient stars;
    private final DashboardProxySupport support;

    @Inject
    public DashboardStarProxyResource(@RestClient DashboardStarClient stars,
                                      DashboardProxySupport support) {
        this.stars = stars;
        this.support = support;
    }

    @GET
    public Uni<Response> list(@PathParam("slug") String slug,
                              @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(stars.list(
                support.tenantIdFor(slug), support.scopeIdFor(), authorization,
                support.assertionFor(slug, authorization)));
    }
}

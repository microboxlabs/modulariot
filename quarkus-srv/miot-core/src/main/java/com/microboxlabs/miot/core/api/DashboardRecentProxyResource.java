package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.eclipse.microprofile.rest.client.inject.RestClient;

/**
 * Auth-gated proxy for the dashboards the caller opened lately. Its own path
 * rather than {@code /dashboards/recents}, so a dashboard called "recents"
 * keeps its address, as with stars and folders.
 */
@Path("/api/v1/orgs/{slug}/dashboard-recents")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Dashboards", description = "Proxy to the dashboard server")
@SecurityRequirement(name = "oidc")
public class DashboardRecentProxyResource {

    private final DashboardRecentClient recents;
    private final DashboardProxySupport support;

    @Inject
    public DashboardRecentProxyResource(@RestClient DashboardRecentClient recents,
                                        DashboardProxySupport support) {
        this.recents = recents;
        this.support = support;
    }

    @GET
    public Uni<Response> list(@PathParam("slug") String slug,
                              @QueryParam("limit") Integer limit,
                              @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(recents.list(
                support.tenantIdFor(slug), support.scopeIdFor(), limit, authorization,
                support.assertionFor(slug, authorization)));
    }
}

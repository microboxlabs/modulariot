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

/** Membership-gated scope permissions, separate from the dashboard slug namespace. */
@Path("/api/v1/orgs/{slug}/dashboard-capabilities")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "Dashboards", description = "Proxy to the dashboard server")
@SecurityRequirement(name = "oidc")
public class DashboardScopeResource {
    private final DashboardScopeClient dashboards;
    private final DashboardProxySupport support;

    @Inject
    public DashboardScopeResource(@RestClient DashboardScopeClient dashboards,
                                  DashboardProxySupport support) {
        this.dashboards = dashboards;
        this.support = support;
    }

    @GET
    public Uni<Response> capabilities(@PathParam("slug") String slug,
                                      @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(dashboards.capabilities(
                support.tenantIdFor(slug), support.scopeIdFor(), authorization,
                support.assertionFor(slug, authorization)));
    }
}

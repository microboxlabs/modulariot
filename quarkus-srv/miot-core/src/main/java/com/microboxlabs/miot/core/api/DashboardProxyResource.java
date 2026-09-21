package com.microboxlabs.miot.core.api;

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
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.eclipse.microprofile.rest.client.inject.RestClient;

/**
 * Auth-gated proxy for the dashboard server's dashboard routes.
 *
 * <p>The {@code /api/v1/orgs/{slug}/...} prefix makes
 * {@code OrganizationRequestFilter} resolve the org membership before this
 * handler runs, so a non-member never reaches the upstream. The caller's
 * bearer token is forwarded verbatim and the dashboard server verifies it
 * and applies its own tenant, scope and per-dashboard rules, the same
 * arrangement as {@link HarnessProxyResource}.
 *
 * <p>This proxy asserts no identity. With {@code miot.dashboards.proxy-key}
 * set it also sends the role the membership filter resolved; the upstream
 * still verifies the bearer token and refuses an assertion naming anyone but
 * the token holder. See {@link DashboardProxySupport}.
 */
@Path("/api/v1/orgs/{slug}/dashboards")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Dashboards", description = "Proxy to the dashboard server")
@SecurityRequirement(name = "oidc")
public class DashboardProxyResource {

    private final DashboardClient dashboards;
    private final DashboardProxySupport support;

    @Inject
    public DashboardProxyResource(@RestClient DashboardClient dashboards,
                                  DashboardProxySupport support) {
        this.dashboards = dashboards;
        this.support = support;
    }

    static String scopeIdFrom(String alfrescoGroupId, String defaultScopeId) {
        return DashboardProxySupport.scopeIdFrom(alfrescoGroupId, defaultScopeId);
    }

    static String dashboardRoleFrom(String alfrescoRole) {
        return DashboardProxySupport.dashboardRoleFrom(alfrescoRole);
    }

    @GET
    public Uni<Response> list(@PathParam("slug") String slug,
                              @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(dashboards.list(
                support.tenantIdFor(slug), support.scopeIdFor(), authorization,
                support.assertionFor(slug, authorization)));
    }

    @GET
    @Path("/{dashboard}")
    public Uni<Response> get(@PathParam("slug") String slug,
                             @PathParam("dashboard") String dashboard,
                             @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(dashboards.get(
                support.tenantIdFor(slug), support.scopeIdFor(), dashboard, authorization,
                support.assertionFor(slug, authorization)));
    }

    @PUT
    @Path("/{dashboard}")
    public Uni<Response> save(@PathParam("slug") String slug,
                              @PathParam("dashboard") String dashboard,
                              @HeaderParam("Authorization") String authorization,
                              @HeaderParam("If-Match") String ifMatch,
                              Map<String, Object> body) {
        return DashboardProxySupport.passThrough(dashboards.save(
                support.tenantIdFor(slug), support.scopeIdFor(), dashboard, authorization, ifMatch,
                support.assertionFor(slug, authorization), body));
    }

    @DELETE
    @Path("/{dashboard}")
    public Uni<Response> delete(@PathParam("slug") String slug,
                                @PathParam("dashboard") String dashboard,
                                @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(dashboards.delete(
                support.tenantIdFor(slug), support.scopeIdFor(), dashboard, authorization,
                support.assertionFor(slug, authorization)));
    }

    @GET
    @Path("/{dashboard}/capabilities")
    public Uni<Response> capabilities(@PathParam("slug") String slug,
                                      @PathParam("dashboard") String dashboard,
                                      @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(dashboards.capabilities(
                support.tenantIdFor(slug), support.scopeIdFor(), dashboard, authorization,
                support.assertionFor(slug, authorization)));
    }

    @GET
    @Path("/{dashboard}/permissions")
    public Uni<Response> getPermissions(@PathParam("slug") String slug,
                                        @PathParam("dashboard") String dashboard,
                                        @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(dashboards.getPermissions(
                support.tenantIdFor(slug), support.scopeIdFor(), dashboard, authorization,
                support.assertionFor(slug, authorization)));
    }

    @PUT
    @Path("/{dashboard}/permissions")
    public Uni<Response> setPermissions(@PathParam("slug") String slug,
                                        @PathParam("dashboard") String dashboard,
                                        @HeaderParam("Authorization") String authorization,
                                        Map<String, Object> body) {
        return DashboardProxySupport.passThrough(dashboards.setPermissions(
                support.tenantIdFor(slug), support.scopeIdFor(), dashboard, authorization,
                support.assertionFor(slug, authorization), body));
    }
}

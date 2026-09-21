package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
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
 * Auth-gated proxy for the dashboard server's datasource routes, the same
 * arrangement as {@link DashboardProxyResource}: the org prefix makes
 * {@code OrganizationRequestFilter} check membership first, the bearer token
 * is forwarded verbatim, and the upstream applies its own rules.
 *
 * <p>Its own path rather than {@code /dashboards/datasources}, because a
 * dashboard may be named {@code datasources}.
 *
 * <p>The credential routes are not forwarded. With the dashboard server
 * configured to ask this modulith for credentials, they answer 404; the
 * credential profiles under {@code /integrations} are the ones a datasource
 * refers to.
 */
@Path("/api/v1/orgs/{slug}/datasources")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Dashboards", description = "Proxy to the dashboard server")
@SecurityRequirement(name = "oidc")
public class DashboardDataSourceProxyResource {

    private final DashboardDataSourceClient datasources;
    private final DashboardProxySupport support;

    @Inject
    public DashboardDataSourceProxyResource(@RestClient DashboardDataSourceClient datasources,
                                            DashboardProxySupport support) {
        this.datasources = datasources;
        this.support = support;
    }

    @GET
    public Uni<Response> list(@PathParam("slug") String slug,
                              @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(datasources.list(
                support.tenantIdFor(slug), support.scopeIdFor(), authorization,
                support.assertionFor(slug, authorization)));
    }

    @POST
    public Uni<Response> create(@PathParam("slug") String slug,
                                @HeaderParam("Authorization") String authorization,
                                Map<String, Object> body) {
        return DashboardProxySupport.passThrough(datasources.create(
                support.tenantIdFor(slug), support.scopeIdFor(), authorization,
                support.assertionFor(slug, authorization), body));
    }

    @POST
    @Path("/test")
    public Uni<Response> testValues(@PathParam("slug") String slug,
                                    @HeaderParam("Authorization") String authorization,
                                    Map<String, Object> body) {
        return DashboardProxySupport.passThrough(datasources.testValues(
                support.tenantIdFor(slug), support.scopeIdFor(), authorization,
                support.assertionFor(slug, authorization), body));
    }

    @GET
    @Path("/{dataSourceId}")
    public Uni<Response> get(@PathParam("slug") String slug,
                             @PathParam("dataSourceId") String dataSourceId,
                             @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(datasources.get(
                support.tenantIdFor(slug), support.scopeIdFor(), dataSourceId, authorization,
                support.assertionFor(slug, authorization)));
    }

    @PUT
    @Path("/{dataSourceId}")
    public Uni<Response> replace(@PathParam("slug") String slug,
                                 @PathParam("dataSourceId") String dataSourceId,
                                 @HeaderParam("Authorization") String authorization,
                                 Map<String, Object> body) {
        return DashboardProxySupport.passThrough(datasources.replace(
                support.tenantIdFor(slug), support.scopeIdFor(), dataSourceId, authorization,
                support.assertionFor(slug, authorization), body));
    }

    @DELETE
    @Path("/{dataSourceId}")
    public Uni<Response> delete(@PathParam("slug") String slug,
                                @PathParam("dataSourceId") String dataSourceId,
                                @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(datasources.delete(
                support.tenantIdFor(slug), support.scopeIdFor(), dataSourceId, authorization,
                support.assertionFor(slug, authorization)));
    }

    @POST
    @Path("/{dataSourceId}/test")
    public Uni<Response> test(@PathParam("slug") String slug,
                              @PathParam("dataSourceId") String dataSourceId,
                              @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(datasources.test(
                support.tenantIdFor(slug), support.scopeIdFor(), dataSourceId, authorization,
                support.assertionFor(slug, authorization)));
    }
}

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
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.eclipse.microprofile.rest.client.inject.RestClient;

/**
 * Auth-gated proxy for the dashboard server's query authoring routes, the same
 * arrangement as {@link DashboardDataSourceProxyResource}. The dashboard server
 * decides who may read, run and save queries from the asserted role.
 */
@Path("/api/v1/orgs/{slug}/query-sources")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Dashboards", description = "Proxy to the dashboard server")
@SecurityRequirement(name = "oidc")
public class DashboardQuerySourceProxyResource {

    private final DashboardQuerySourceClient sources;
    private final DashboardProxySupport support;

    @Inject
    public DashboardQuerySourceProxyResource(@RestClient DashboardQuerySourceClient sources,
                                             DashboardProxySupport support) {
        this.sources = sources;
        this.support = support;
    }

    @GET
    public Uni<Response> list(@PathParam("slug") String slug,
                              @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(sources.sources(
                support.tenantIdFor(slug), support.scopeIdFor(), authorization,
                support.assertionFor(slug, authorization)));
    }

    @GET
    @Path("/{sourceId}/schema")
    public Uni<Response> schema(@PathParam("slug") String slug,
                                @PathParam("sourceId") String sourceId,
                                @QueryParam("projectId") String projectId,
                                @QueryParam("refresh") String refresh,
                                @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(sources.schema(
                support.tenantIdFor(slug), support.scopeIdFor(), sourceId, projectId, refresh,
                authorization, support.assertionFor(slug, authorization)));
    }

    @GET
    @Path("/{sourceId}/plans")
    public Uni<Response> plans(@PathParam("slug") String slug,
                               @PathParam("sourceId") String sourceId,
                               @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(sources.plans(
                support.tenantIdFor(slug), support.scopeIdFor(), sourceId, authorization,
                support.assertionFor(slug, authorization)));
    }

    @POST
    @Path("/{sourceId}/plans")
    public Uni<Response> create(@PathParam("slug") String slug,
                                @PathParam("sourceId") String sourceId,
                                @HeaderParam("Authorization") String authorization,
                                Map<String, Object> body) {
        return DashboardProxySupport.passThrough(sources.create(
                support.tenantIdFor(slug), support.scopeIdFor(), sourceId, authorization,
                support.assertionFor(slug, authorization), body));
    }

    @GET
    @Path("/{sourceId}/plans/{planId}")
    public Uni<Response> plan(@PathParam("slug") String slug,
                              @PathParam("sourceId") String sourceId,
                              @PathParam("planId") String planId,
                              @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(sources.plan(
                support.tenantIdFor(slug), support.scopeIdFor(), sourceId, planId, authorization,
                support.assertionFor(slug, authorization)));
    }

    @PUT
    @Path("/{sourceId}/plans/{planId}")
    public Uni<Response> replace(@PathParam("slug") String slug,
                                 @PathParam("sourceId") String sourceId,
                                 @PathParam("planId") String planId,
                                 @HeaderParam("Authorization") String authorization,
                                 @HeaderParam("If-Match") String ifMatch,
                                 Map<String, Object> body) {
        return DashboardProxySupport.passThrough(sources.replace(
                support.tenantIdFor(slug), support.scopeIdFor(), sourceId, planId, authorization, ifMatch,
                support.assertionFor(slug, authorization), body));
    }

    @DELETE
    @Path("/{sourceId}/plans/{planId}")
    public Uni<Response> delete(@PathParam("slug") String slug,
                                @PathParam("sourceId") String sourceId,
                                @PathParam("planId") String planId,
                                @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(sources.delete(
                support.tenantIdFor(slug), support.scopeIdFor(), sourceId, planId, authorization,
                support.assertionFor(slug, authorization)));
    }

    @POST
    @Path("/{sourceId}/estimate")
    public Uni<Response> estimate(@PathParam("slug") String slug,
                                  @PathParam("sourceId") String sourceId,
                                  @HeaderParam("Authorization") String authorization,
                                  Map<String, Object> body) {
        return DashboardProxySupport.passThrough(sources.estimate(
                support.tenantIdFor(slug), support.scopeIdFor(), sourceId, authorization,
                support.assertionFor(slug, authorization), body));
    }

    @POST
    @Path("/{sourceId}/preview")
    public Uni<Response> preview(@PathParam("slug") String slug,
                                 @PathParam("sourceId") String sourceId,
                                 @HeaderParam("Authorization") String authorization,
                                 Map<String, Object> body) {
        return DashboardProxySupport.passThrough(sources.preview(
                support.tenantIdFor(slug), support.scopeIdFor(), sourceId, authorization,
                support.assertionFor(slug, authorization), body));
    }
}

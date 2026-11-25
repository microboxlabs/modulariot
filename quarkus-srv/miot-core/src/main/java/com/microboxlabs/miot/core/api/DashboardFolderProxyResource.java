package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PATCH;
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
 * Auth-gated proxy for the dashboard server's folders. Its own path rather
 * than {@code /dashboards/folders}, so a dashboard called "folders" keeps its
 * address — the same reason scope capabilities live apart.
 *
 * <p>Membership is resolved by {@code OrganizationRequestFilter} before this
 * runs; the upstream decides which role may create, move or delete.
 */
@Path("/api/v1/orgs/{slug}/dashboard-folders")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Dashboards", description = "Proxy to the dashboard server")
@SecurityRequirement(name = "oidc")
public class DashboardFolderProxyResource {

    private final DashboardFolderClient folders;
    private final DashboardProxySupport support;

    @Inject
    public DashboardFolderProxyResource(@RestClient DashboardFolderClient folders,
                                        DashboardProxySupport support) {
        this.folders = folders;
        this.support = support;
    }

    @GET
    public Uni<Response> list(@PathParam("slug") String slug,
                              @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(folders.list(
                support.tenantIdFor(slug), support.scopeIdFor(), authorization,
                support.assertionFor(slug, authorization)));
    }

    @POST
    public Uni<Response> create(@PathParam("slug") String slug,
                                @HeaderParam("Authorization") String authorization,
                                Map<String, Object> body) {
        return DashboardProxySupport.passThrough(folders.create(
                support.tenantIdFor(slug), support.scopeIdFor(), authorization,
                support.assertionFor(slug, authorization), body));
    }

    @PATCH
    @Path("/{folderId}")
    public Uni<Response> update(@PathParam("slug") String slug,
                                @PathParam("folderId") String folderId,
                                @HeaderParam("Authorization") String authorization,
                                Map<String, Object> body) {
        return DashboardProxySupport.passThrough(folders.update(
                support.tenantIdFor(slug), support.scopeIdFor(), folderId, authorization,
                support.assertionFor(slug, authorization), body));
    }

    @DELETE
    @Path("/{folderId}")
    public Uni<Response> delete(@PathParam("slug") String slug,
                                @PathParam("folderId") String folderId,
                                @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(folders.delete(
                support.tenantIdFor(slug), support.scopeIdFor(), folderId, authorization,
                support.assertionFor(slug, authorization)));
    }

    @GET
    @Path("/{folderId}/permissions")
    public Uni<Response> permissions(@PathParam("slug") String slug,
                                     @PathParam("folderId") String folderId,
                                     @HeaderParam("Authorization") String authorization) {
        return DashboardProxySupport.passThrough(folders.permissions(
                support.tenantIdFor(slug), support.scopeIdFor(), folderId, authorization,
                support.assertionFor(slug, authorization)));
    }

    @PUT
    @Path("/{folderId}/permissions")
    public Uni<Response> setPermissions(@PathParam("slug") String slug,
                                        @PathParam("folderId") String folderId,
                                        @HeaderParam("Authorization") String authorization,
                                        Map<String, Object> body) {
        return DashboardProxySupport.passThrough(folders.setPermissions(
                support.tenantIdFor(slug), support.scopeIdFor(), folderId, authorization,
                support.assertionFor(slug, authorization), body));
    }
}

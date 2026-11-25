package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.BeanParam;
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
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/**
 * The dashboard server's folder routes. A folder only arranges a scope's
 * dashboards for browsing; the upstream applies its own role rules, so this
 * client forwards the caller's token and the membership assertion and nothing
 * more. Same binding as {@link DashboardClient}.
 */
@RegisterRestClient(configKey = "dashboards")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Path("/tenants/{tenantId}/scopes/{scopeId}/folders")
public interface DashboardFolderClient {

    @GET
    Uni<Response> list(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);

    @POST
    Uni<Response> create(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion,
            Map<String, Object> body);

    @PATCH
    @Path("/{folderId}")
    Uni<Response> update(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("folderId") String folderId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion,
            Map<String, Object> body);

    @DELETE
    @Path("/{folderId}")
    Uni<Response> delete(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("folderId") String folderId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);

    @GET
    @Path("/{folderId}/permissions")
    Uni<Response> permissions(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("folderId") String folderId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);

    @PUT
    @Path("/{folderId}/permissions")
    Uni<Response> setPermissions(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("folderId") String folderId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion,
            Map<String, Object> body);
}

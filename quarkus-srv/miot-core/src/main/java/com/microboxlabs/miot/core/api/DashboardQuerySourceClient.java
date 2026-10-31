package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.BeanParam;
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
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/** The dashboard server's query authoring routes, on the same {@code "dashboards"} binding. */
@RegisterRestClient(configKey = "dashboards")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Path("/tenants/{tenantId}/scopes/{scopeId}/query-sources")
public interface DashboardQuerySourceClient {

    @GET
    Uni<Response> sources(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);

    @GET
    @Path("/{sourceId}/schema")
    Uni<Response> schema(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("sourceId") String sourceId,
            @QueryParam("projectId") String projectId,
            @QueryParam("refresh") String refresh,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);

    @GET
    @Path("/{sourceId}/plans")
    Uni<Response> plans(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("sourceId") String sourceId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);

    @POST
    @Path("/{sourceId}/plans")
    Uni<Response> create(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("sourceId") String sourceId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion,
            Map<String, Object> body);

    @GET
    @Path("/{sourceId}/plans/{planId}")
    Uni<Response> plan(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("sourceId") String sourceId,
            @PathParam("planId") String planId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);

    @PUT
    @Path("/{sourceId}/plans/{planId}")
    Uni<Response> replace(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("sourceId") String sourceId,
            @PathParam("planId") String planId,
            @HeaderParam("Authorization") String authorization,
            @HeaderParam("If-Match") String ifMatch,
            @BeanParam DashboardAssertion assertion,
            Map<String, Object> body);

    @DELETE
    @Path("/{sourceId}/plans/{planId}")
    Uni<Response> delete(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("sourceId") String sourceId,
            @PathParam("planId") String planId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);

    @POST
    @Path("/{sourceId}/estimate")
    Uni<Response> estimate(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("sourceId") String sourceId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion,
            Map<String, Object> body);

    @POST
    @Path("/{sourceId}/preview")
    Uni<Response> preview(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("sourceId") String sourceId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion,
            Map<String, Object> body);
}

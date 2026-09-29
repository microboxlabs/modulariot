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
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/**
 * The dashboard server's datasource routes, on the same {@code "dashboards"}
 * binding as {@link DashboardClient}. A datasource names a credential by
 * reference only; the dashboard server asks this modulith for the applied
 * auth when it runs a query.
 */
@RegisterRestClient(configKey = "dashboards")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Path("/tenants/{tenantId}/scopes/{scopeId}/datasources")
public interface DashboardDataSourceClient {

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

    /** Tries a datasource that is not stored yet. */
    @POST
    @Path("/test")
    Uni<Response> testValues(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion,
            Map<String, Object> body);

    @GET
    @Path("/{dataSourceId}")
    Uni<Response> get(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("dataSourceId") String dataSourceId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);

    @PUT
    @Path("/{dataSourceId}")
    Uni<Response> replace(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("dataSourceId") String dataSourceId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion,
            Map<String, Object> body);

    @DELETE
    @Path("/{dataSourceId}")
    Uni<Response> delete(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("dataSourceId") String dataSourceId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);

    @POST
    @Path("/{dataSourceId}/test")
    Uni<Response> test(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @PathParam("dataSourceId") String dataSourceId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);
}

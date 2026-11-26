package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.BeanParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/**
 * The dashboard server's list of the dashboards the caller opened lately.
 * Recording an open is on {@link DashboardClient}. Same binding.
 */
@RegisterRestClient(configKey = "dashboards")
@Produces(MediaType.APPLICATION_JSON)
@Path("/tenants/{tenantId}/scopes/{scopeId}/recents")
public interface DashboardRecentClient {

    @GET
    Uni<Response> list(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @QueryParam("limit") Integer limit,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);
}

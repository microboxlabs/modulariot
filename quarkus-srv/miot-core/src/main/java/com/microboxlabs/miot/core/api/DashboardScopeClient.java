package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.BeanParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/** Scope eligibility comes from the dashboard server, not the application's coarse role. */
@RegisterRestClient(configKey = "dashboards")
@Produces(MediaType.APPLICATION_JSON)
@Path("/tenants/{tenantId}/scopes/{scopeId}/capabilities")
public interface DashboardScopeClient {
    @GET
    Uni<Response> capabilities(
            @PathParam("tenantId") String tenantId,
            @PathParam("scopeId") String scopeId,
            @HeaderParam("Authorization") String authorization,
            @BeanParam DashboardAssertion assertion);
}

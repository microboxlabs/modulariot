package com.microboxlabs.miot.core.api;

import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/**
 * Reactive REST Client for {@code miot-harness}. The {@code "harness"}
 * binding name matches {@code quarkus.rest-client."harness".url}.
 *
 * <p>{@link HarnessProxyResource} forwards the caller's Auth0 bearer
 * token plus four {@code X-Miot-*} identity headers verbatim:
 * tenant-client-id (from {@code TenantContext}), user-email (web flow
 * only), and auth-mode ({@code "web"} vs {@code "m2m"}).
 *
 * <p>Methods return {@code Uni<Response>} so upstream status codes
 * (notably 202 from {@code /runs:start}) propagate to the caller
 * unchanged.
 */
@RegisterRestClient(configKey = "harness")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface HarnessClient {

    @POST
    @Path("/runs")
    Uni<Response> createRun(
            @HeaderParam("Authorization") String authorization,
            @HeaderParam("X-Miot-Tenant-Client-Id") String tenantClientId,
            @HeaderParam("X-Miot-User-Email") String userEmail,
            @HeaderParam("X-Miot-Auth-Mode") String authMode,
            Map<String, Object> body);

    @POST
    @Path("/runs:start")
    Uni<Response> startRun(
            @HeaderParam("Authorization") String authorization,
            @HeaderParam("X-Miot-Tenant-Client-Id") String tenantClientId,
            @HeaderParam("X-Miot-User-Email") String userEmail,
            @HeaderParam("X-Miot-Auth-Mode") String authMode,
            Map<String, Object> body);

    @GET
    @Path("/runs/{runId}")
    Uni<Response> getRun(
            @PathParam("runId") String runId,
            @HeaderParam("Authorization") String authorization,
            @HeaderParam("X-Miot-Tenant-Client-Id") String tenantClientId,
            @HeaderParam("X-Miot-User-Email") String userEmail,
            @HeaderParam("X-Miot-Auth-Mode") String authMode);
}

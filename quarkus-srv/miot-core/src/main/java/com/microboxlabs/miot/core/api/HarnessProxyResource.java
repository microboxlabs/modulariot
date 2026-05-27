package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.eclipse.microprofile.rest.client.inject.RestClient;

/**
 * Auth0-gated proxy for miot-harness's {@code /runs} endpoints.
 *
 * <p>The {@code /api/v1/orgs/{slug}/...} prefix makes
 * {@code OrganizationRequestFilter} resolve the org membership before
 * this handler ever runs, so the auth + membership invariants live in
 * one place. The proxy then forwards the caller's bearer token plus
 * {@code X-Miot-*} identity headers to the harness so the harness can
 * enforce its own tenant + user invariants without re-parsing the JWT.
 *
 * <p>Q1 covers POST {@code /runs} and POST {@code /runs:start};
 * GET {@code /runs/{runId}} is Q2 and the SSE relay is Q3.
 */
@Path("/api/v1/orgs/{slug}/harness")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Harness", description = "Proxy to the miot-harness LLM runs API")
@SecurityRequirement(name = "oidc")
public class HarnessProxyResource {

    private final HarnessClient harness;
    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;

    @Inject
    public HarnessProxyResource(@RestClient HarnessClient harness,
                                TenantContext tenantContext,
                                OrganizationContext organizationContext) {
        this.harness = harness;
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
    }

    @POST
    @Path("/runs")
    public Uni<Response> createRun(@PathParam("slug") String slug,
                                   @HeaderParam("Authorization") String authorization,
                                   Map<String, Object> body) {
        return forward(authorization, body, harness::createRun);
    }

    // Quarkus REST Reactive does not register a literal ':' in @Path values,
    // so the action segment is declared via a regex path parameter that
    // matches exactly "runs:start". The captured value is unused.
    @POST
    @Path("/{startAction:runs:start}")
    public Uni<Response> startRun(@PathParam("slug") String slug,
                                  @PathParam("startAction") String startAction,
                                  @HeaderParam("Authorization") String authorization,
                                  Map<String, Object> body) {
        return forward(authorization, body, harness::startRun);
    }

    @GET
    @Path("/runs/{runId}")
    public Uni<Response> getRun(@PathParam("slug") String slug,
                                @PathParam("runId") String runId,
                                @HeaderParam("Authorization") String authorization) {
        String tenantClientId = tenantContext.getClientId();
        String userEmail = organizationContext.getUserEmail();
        String authMode = userEmail != null ? "web" : "m2m";
        return passThrough(harness.getRun(runId, authorization, tenantClientId, userEmail, authMode));
    }

    private Uni<Response> forward(String authorization,
                                  Map<String, Object> body,
                                  HarnessCall call) {
        String tenantClientId = tenantContext.getClientId();
        String userEmail = organizationContext.getUserEmail();
        // Web tokens carry an email claim; M2M tokens don't. Flagging
        // the mode explicitly spares the harness from re-deriving it.
        String authMode = userEmail != null ? "web" : "m2m";
        return passThrough(call.apply(authorization, tenantClientId, userEmail, authMode, body));
    }

    /**
     * Pass upstream status + body through unchanged. Quarkus REST
     * Reactive throws {@link WebApplicationException} for any non-2xx
     * harness response; unwrap it so the original status (404, 500, …)
     * reaches the caller instead of becoming a proxy-side 500.
     */
    private static Uni<Response> passThrough(Uni<Response> upstream) {
        return upstream
                .onFailure(WebApplicationException.class)
                .recoverWithItem(HarnessProxyResource::unwrapResponse)
                .map(r -> Response.fromResponse(r).build());
    }

    private static Response unwrapResponse(Throwable err) {
        if (err instanceof WebApplicationException wae) {
            return wae.getResponse();
        }
        throw new IllegalStateException("Expected WebApplicationException from upstream", err);
    }

    @FunctionalInterface
    private interface HarnessCall {
        Uni<Response> apply(String authorization,
                            String tenantClientId,
                            String userEmail,
                            String authMode,
                            Map<String, Object> body);
    }
}

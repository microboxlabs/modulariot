package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import io.smallrye.mutiny.Uni;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.http.RequestOptions;
import io.vertx.ext.web.RoutingContext;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.core.http.HttpClient;
import io.vertx.mutiny.core.http.HttpServerResponse;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.eclipse.microprofile.rest.client.inject.RestClient;

/**
 * Auth0-gated proxy for miot-harness's {@code /runs} and {@code /skills}
 * endpoints.
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
    private final HttpClient httpClient;
    private final String harnessBaseUrl;

    @Inject
    public HarnessProxyResource(@RestClient HarnessClient harness,
                                TenantContext tenantContext,
                                OrganizationContext organizationContext,
                                Vertx vertx,
                                @ConfigProperty(name = "miot.harness.base-url")
                                String harnessBaseUrl) {
        this.harness = harness;
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        // Dedicated streaming client for the SSE relay: the JSON rest-client
        // buffers full responses, which never completes for an open event
        // stream. A raw Vert.x client lets us pipe harness frames straight
        // through (id:/event:/data: preserved) without SSE re-encoding.
        this.httpClient = vertx.createHttpClient();
        this.harnessBaseUrl = stripTrailingSlash(harnessBaseUrl);
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
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

    /**
     * Lists the skills the harness can run — the data behind the chat
     * {@code /skills} picker and {@code miot harness skills}. Sits behind
     * the same auth + org-membership chain as the run routes, and forwards
     * the optional {@code tenant} query param plus the caller identity so
     * the harness resolves the same tenant it would for a run.
     */
    @GET
    @Path("/skills")
    public Uni<Response> listSkills(@PathParam("slug") String slug,
                                    @QueryParam("tenant") String tenant,
                                    @HeaderParam("Authorization") String authorization) {
        String tenantClientId = tenantContext.getClientId();
        String userEmail = organizationContext.getUserEmail();
        String authMode = userEmail != null ? "web" : "m2m";
        return passThrough(
                harness.listSkills(tenant, authorization, tenantClientId, userEmail, authMode));
    }

    /**
     * SSE relay (Q3) for the harness {@code GET /runs/{runId}/stream}.
     * Streams the harness event stream straight to the browser, preserving
     * the {@code id:}/{@code event:}/{@code data:} framing byte-for-byte —
     * a raw passthrough rather than a {@code @RestStreamElementType}
     * producer, which would re-wrap each chunk and drop the id/event lines.
     * Auth + org membership are inherited from the path prefix exactly like
     * the other routes, so a non-member never reaches this method.
     */
    @GET
    @Path("/runs/{runId}/stream")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    public Uni<Void> streamRun(@PathParam("slug") String slug,
                               @PathParam("runId") String runId,
                               @HeaderParam("Authorization") String authorization,
                               @HeaderParam("Last-Event-ID") String lastEventId,
                               RoutingContext routingContext) {
        String tenantClientId = tenantContext.getClientId();
        String userEmail = organizationContext.getUserEmail();
        String authMode = userEmail != null ? "web" : "m2m";

        RequestOptions options = new RequestOptions()
                .setMethod(HttpMethod.GET)
                .setAbsoluteURI(harnessBaseUrl + "/runs/" + runId + "/stream");

        return httpClient.request(options)
                .flatMap(req -> {
                    if (authorization != null) {
                        req.putHeader("Authorization", authorization);
                    }
                    if (tenantClientId != null) {
                        req.putHeader("X-Miot-Tenant-Client-Id", tenantClientId);
                    }
                    if (userEmail != null) {
                        req.putHeader("X-Miot-User-Email", userEmail);
                    }
                    req.putHeader("X-Miot-Auth-Mode", authMode);
                    if (lastEventId != null) {
                        req.putHeader("Last-Event-ID", lastEventId);
                    }
                    return req.send();
                })
                // Take sole ownership of the Vert.x response and pipe the
                // harness body straight through: status + framing headers
                // copied from upstream, then pipeTo streams every chunk
                // byte-for-byte (id:/event:/data: preserved) and ends the
                // response when the harness closes the stream. A single owner
                // here avoids the chunk corruption that arises from mixing a
                // framework streaming writer with manual response writes.
                .flatMap(resp -> {
                    HttpServerResponse out =
                            HttpServerResponse.newInstance(routingContext.response());
                    out.setStatusCode(resp.statusCode());
                    String contentType = resp.headers().get("Content-Type");
                    out.putHeader("Content-Type",
                            contentType != null ? contentType : MediaType.SERVER_SENT_EVENTS);
                    out.putHeader("Cache-Control", "no-cache");
                    out.putHeader("X-Accel-Buffering", "no");
                    out.setChunked(true);
                    return resp.pipeTo(out);
                });
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

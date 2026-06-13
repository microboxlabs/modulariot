package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.M2MAuth;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.dto.ClaimJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.ReportJobRequest;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Org-scoped control plane for the integration outbox.
 *
 * <p>Endpoints return {@link Uni} so the request runs on the Vert.x event loop:
 * org-scoped resources go through {@code OrganizationRequestFilter}, which uses
 * Hibernate Reactive and asserts the event-loop thread. The blocking
 * {@link AsyncJobService} (Vert.x SQL client with {@code await()}) is therefore
 * offloaded to the worker pool via {@link #onWorker}. The request-scoped
 * tenant/org contexts are resolved eagerly on the event loop (the filter has
 * already populated them) and the resolved tenant code is captured before
 * offloading, so the worker task does not depend on request-scope propagation.
 */
@Path("/api/v1/orgs/{organizationId}/integrations/jobs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Async Jobs", description = "Durable ledger and control plane for externally-executed integration jobs")
@SecurityRequirement(name = "oidc")
@Authenticated
// The caller is a machine (ECM) using an Auth0 client-credentials token →
// HS256/M2M verification. Org membership for M2M is validated by
// OrganizationRequestFilter (token azp/aud == org.tenantClientId), no Alfresco.
@M2MAuth
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgAsyncJobsResource {

    private static final String ERROR_KEY = "error";

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final AsyncJobService service;

    @Inject
    public OrgAsyncJobsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            AsyncJobService service) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.service = service;
    }

    @POST
    @Path("/enqueue")
    @Operation(summary = "Idempotently enqueue a batch of jobs (dedupe-key aware)")
    public Uni<Response> enqueue(@PathParam("organizationId") String organizationId, EnqueueJobsRequest request) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> Response.ok(service.enqueue(tenant, request)).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> errorResponse(Response.Status.BAD_REQUEST, e.getMessage(), "Bad request"));
    }

    @POST
    @Path("/claim")
    @Operation(summary = "Claim runnable jobs for an executor with a lease")
    public Uni<Response> claim(@PathParam("organizationId") String organizationId, ClaimJobsRequest request) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> Response.ok(service.claim(tenant, request)).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> errorResponse(Response.Status.BAD_REQUEST, e.getMessage(), "Bad request"));
    }

    @POST
    @Path("/{jobId}/report")
    @Operation(summary = "Report the outcome of a claimed job")
    public Uni<Response> report(
            @PathParam("organizationId") String organizationId,
            @PathParam("jobId") String jobId,
            ReportJobRequest request) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> {
            AsyncJob job = service.report(tenant, jobId, request);
            return job == null ? notFound(jobId) : Response.ok(job).build();
        })
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> errorResponse(Response.Status.BAD_REQUEST, e.getMessage(), "Bad request"))
                .onFailure(IllegalStateException.class)
                .recoverWithItem(e -> errorResponse(Response.Status.CONFLICT, e.getMessage(), "Conflict"));
    }

    @POST
    @Path("/{jobId}/retry")
    @Operation(summary = "Manually reset a parked job so workers pick it up again")
    public Uni<Response> retry(
            @PathParam("organizationId") String organizationId,
            @PathParam("jobId") String jobId) {
        String tenant = tenantCode(organizationId);
        String actor = tenantContext.getClientId();
        return onWorker(() -> {
            AsyncJob job = service.retry(tenant, jobId, actor);
            return job == null ? notFound(jobId) : Response.ok(job).build();
        })
                .onFailure(IllegalStateException.class)
                .recoverWithItem(e -> errorResponse(Response.Status.CONFLICT, e.getMessage(), "Conflict"));
    }

    @GET
    @Operation(summary = "List jobs with optional filters")
    public Uni<Response> list(
            @PathParam("organizationId") String organizationId,
            @QueryParam("state") String state,
            @QueryParam("correlationKey") String correlationKey,
            @QueryParam("jobType") String jobType,
            @QueryParam("limit") @DefaultValue("100") int limit) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> Response.ok(
                service.list(tenant, state, correlationKey, jobType, Math.min(limit, 500))).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(errorResponse(Response.Status.BAD_REQUEST, "Invalid state filter: " + state, null));
    }

    @GET
    @Path("/{jobId}")
    @Operation(summary = "Get a job with its full attempt history")
    public Uni<Response> get(
            @PathParam("organizationId") String organizationId,
            @PathParam("jobId") String jobId) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> {
            AsyncJob job = service.get(tenant, jobId);
            return job == null ? notFound(jobId) : Response.ok(job).build();
        });
    }

    /**
     * Runs a blocking supplier on the worker pool so this non-blocking endpoint
     * keeps the request on the event loop (required by the reactive org filter).
     */
    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private String tenantCode(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(
                    errorResponse(Response.Status.FORBIDDEN, "Organization context does not match request path", null));
        }
        return tenantContext.getTenantCode() != null ? tenantContext.getTenantCode() : tenantContext.getClientId();
    }

    private Response notFound(String jobId) {
        return errorResponse(Response.Status.NOT_FOUND, "Job not found: " + jobId, null);
    }

    private static Response errorResponse(Response.Status status, String message, String fallback) {
        String body = message != null ? message : fallback;
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of(ERROR_KEY, body))
                .build();
    }
}

package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobLedgerFacets;
import com.microboxlabs.miot.integrations.domain.JobQuery;
import com.microboxlabs.miot.integrations.events.JobEventEmitter;
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
 * Read/babysit surface of the integration outbox for the web job console.
 *
 * <p>Unlike {@link OrgAsyncJobsResource} (the {@code @M2MAuth} control plane
 * ECM drives), this resource is called by org members with an RS256 web token:
 * membership and role come from {@code OrganizationRequestFilter} via Alfresco.
 * It deliberately lives under {@code /integrations/console/jobs} — a path NOT
 * prefixed by {@code /integrations/jobs} — so the dual-JWT path matcher never
 * routes it to HS256/M2M verification.
 *
 * <p>Same reactive contract as the other org-scoped resources: endpoints
 * return {@link Uni}, tenant context is resolved eagerly on the event loop and
 * the blocking {@link AsyncJobService} runs on the worker pool.
 */
@Path("/api/v1/orgs/{organizationId}/integrations/console/jobs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Async Jobs Console", description = "Org-member read and babysit surface for integration jobs")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgAsyncJobsConsoleResource {

    private static final String ERROR_KEY = "error";
    private static final String CONFLICT = "Conflict";
    private static final int MAX_PAGE_SIZE = 500;

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final AsyncJobService service;
    private final JobEventEmitter eventEmitter;

    @Inject
    public OrgAsyncJobsConsoleResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            AsyncJobService service,
            JobEventEmitter eventEmitter) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.service = service;
        this.eventEmitter = eventEmitter;
    }

    @GET
    @Operation(summary = "List one page of the org's jobs, newest first")
    public Uni<Response> list(
            @PathParam("organizationId") String organizationId,
            @QueryParam("state") String state,
            @QueryParam("correlationKey") String correlationKey,
            @QueryParam("jobType") String jobType,
            @QueryParam("chainKey") String chainKey,
            @QueryParam("executor") String executor,
            @QueryParam("search") String search,
            @QueryParam("limit") @DefaultValue("100") int limit,
            @QueryParam("offset") @DefaultValue("0") int offset) {
        String tenant = tenantCode(organizationId);
        // The page size is capped here so one request can never scan the whole ledger.
        JobQuery query = new JobQuery(state, correlationKey, jobType, chainKey, executor, search,
                Math.min(limit, MAX_PAGE_SIZE), offset);
        return onWorker(() -> Response.ok(service.list(tenant, query)).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(OrgAsyncJobsConsoleResource::badRequest);
    }

    /**
     * How many jobs match the same filters as {@link #list}, so the console can
     * show "1–50 of N" and stop paging at the end. Deliberately a second call
     * rather than an envelope around the list: the count only changes when a
     * filter does, so paging never pays for it.
     */
    @GET
    @Path("/count")
    @Operation(summary = "Total jobs matching the list filters")
    public Uni<Response> count(
            @PathParam("organizationId") String organizationId,
            @QueryParam("state") String state,
            @QueryParam("correlationKey") String correlationKey,
            @QueryParam("jobType") String jobType,
            @QueryParam("chainKey") String chainKey,
            @QueryParam("executor") String executor,
            @QueryParam("search") String search) {
        String tenant = tenantCode(organizationId);
        // The window is ignored by the count; 1/0 just keeps the record valid.
        JobQuery query = new JobQuery(state, correlationKey, jobType, chainKey, executor, search, 1, 0);
        return onWorker(() -> Response.ok(Map.of("total", service.count(tenant, query))).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(OrgAsyncJobsConsoleResource::badRequest);
    }

    /**
     * One round-trip bootstrap for the console: whole-ledger per-state counts,
     * the job types and executor lanes its filters offer (facets of the whole
     * ledger, not of the page on screen), plus what the browser needs to
     * subscribe to the live quarkus-sse stream ({@code tenantId} is the SSE
     * stream key — the org's tenant code — which the {@code /me/scopes} payload
     * deliberately does not expose).
     */
    @GET
    @Path("/overview")
    @Operation(summary = "Per-state counts, filter facets and the live-stream subscription context")
    public Uni<Response> overview(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> {
            JobLedgerFacets facets = service.facets(tenant);
            return Response.ok(Map.of(
                    "counts", facets.counts(),
                    "jobTypes", facets.jobTypes(),
                    "executors", facets.executors(),
                    "tenantId", tenant,
                    "eventType", JobEventEmitter.EVENT_TYPE,
                    "liveEventsConfigured", eventEmitter.isConfigured())).build();
        });
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

    @POST
    @Path("/{jobId}/retry")
    @Operation(summary = "Manually reset a parked job so workers pick it up again")
    public Uni<Response> retry(
            @PathParam("organizationId") String organizationId,
            @PathParam("jobId") String jobId) {
        String tenant = tenantCode(organizationId);
        String actor = organizationContext.getUserEmail() != null
                ? organizationContext.getUserEmail()
                : tenantContext.getClientId();
        return onWorker(() -> {
            AsyncJob job = service.retry(tenant, jobId, actor);
            return job == null ? notFound(jobId) : Response.ok(job).build();
        })
                .onFailure(IllegalStateException.class)
                .recoverWithItem(e -> errorResponse(Response.Status.CONFLICT, e.getMessage(), CONFLICT));
    }

    private static Response badRequest(Throwable failure) {
        return errorResponse(Response.Status.BAD_REQUEST, failure.getMessage(), "Invalid job filter");
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
        if (body == null) {
            body = status.getReasonPhrase();
        }
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of(ERROR_KEY, body))
                .build();
    }
}

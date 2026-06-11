package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.dto.ClaimJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.ReportJobRequest;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
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
import java.util.Objects;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/api/v1/orgs/{organizationId}/integrations/jobs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Async Jobs", description = "Durable ledger and control plane for externally-executed integration jobs")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgAsyncJobsResource {

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
    public Response enqueue(@PathParam("organizationId") String organizationId, EnqueueJobsRequest request) {
        try {
            return Response.ok(service.enqueue(tenantCode(organizationId), request)).build();
        } catch (IllegalArgumentException e) {
            throw badRequest(e.getMessage());
        }
    }

    @POST
    @Path("/claim")
    @Operation(summary = "Claim runnable jobs for an executor with a lease")
    public Response claim(@PathParam("organizationId") String organizationId, ClaimJobsRequest request) {
        tenantCode(organizationId); // enforce org context
        try {
            return Response.ok(service.claim(request)).build();
        } catch (IllegalArgumentException e) {
            throw badRequest(e.getMessage());
        }
    }

    @POST
    @Path("/{jobId}/report")
    @Operation(summary = "Report the outcome of a claimed job")
    public Response report(
            @PathParam("organizationId") String organizationId,
            @PathParam("jobId") String jobId,
            ReportJobRequest request) {
        try {
            AsyncJob job = service.report(tenantCode(organizationId), jobId, request);
            return job == null ? notFound(jobId) : Response.ok(job).build();
        } catch (IllegalArgumentException e) {
            throw badRequest(e.getMessage());
        } catch (IllegalStateException e) {
            throw conflict(e.getMessage());
        }
    }

    @POST
    @Path("/{jobId}/retry")
    @Operation(summary = "Manually reset a parked job so workers pick it up again")
    public Response retry(
            @PathParam("organizationId") String organizationId,
            @PathParam("jobId") String jobId) {
        try {
            AsyncJob job = service.retry(tenantCode(organizationId), jobId, tenantContext.getClientId());
            return job == null ? notFound(jobId) : Response.ok(job).build();
        } catch (IllegalStateException e) {
            throw conflict(e.getMessage());
        }
    }

    @GET
    @Operation(summary = "List jobs with optional filters")
    public Response list(
            @PathParam("organizationId") String organizationId,
            @QueryParam("state") String state,
            @QueryParam("correlationKey") String correlationKey,
            @QueryParam("jobType") String jobType,
            @QueryParam("limit") @DefaultValue("100") int limit) {
        try {
            return Response.ok(
                    service.list(tenantCode(organizationId), state, correlationKey, jobType, Math.min(limit, 500)))
                    .build();
        } catch (IllegalArgumentException e) {
            throw badRequest("Invalid state filter: " + state);
        }
    }

    @GET
    @Path("/{jobId}")
    @Operation(summary = "Get a job with its full attempt history")
    public Response get(
            @PathParam("organizationId") String organizationId,
            @PathParam("jobId") String jobId) {
        AsyncJob job = service.get(tenantCode(organizationId), jobId);
        return job == null ? notFound(jobId) : Response.ok(job).build();
    }

    private String tenantCode(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(Response.status(Response.Status.FORBIDDEN)
                    .type(MediaType.APPLICATION_JSON)
                    .entity("{\"error\":\"Organization context does not match request path\"}")
                    .build());
        }
        return tenantContext.getTenantCode() != null ? tenantContext.getTenantCode() : tenantContext.getClientId();
    }

    private WebApplicationException badRequest(String message) {
        return new WebApplicationException(Response.status(Response.Status.BAD_REQUEST)
                .type(MediaType.APPLICATION_JSON)
                .entity("{\"error\":\"" + message + "\"}")
                .build());
    }

    private WebApplicationException conflict(String message) {
        return new WebApplicationException(Response.status(Response.Status.CONFLICT)
                .type(MediaType.APPLICATION_JSON)
                .entity("{\"error\":\"" + message + "\"}")
                .build());
    }

    private Response notFound(String jobId) {
        return Response.status(Response.Status.NOT_FOUND)
                .type(MediaType.APPLICATION_JSON)
                .entity("{\"error\":\"Job not found: " + jobId + "\"}")
                .build();
    }
}

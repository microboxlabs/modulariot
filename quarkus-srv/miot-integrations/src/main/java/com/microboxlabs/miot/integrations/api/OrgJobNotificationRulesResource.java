package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.domain.JobNotificationRule;
import com.microboxlabs.miot.integrations.dto.NotificationRuleRequest;
import com.microboxlabs.miot.integrations.jobs.JobFailureNotificationFeature;
import com.microboxlabs.miot.integrations.persistence.JobNotificationRuleRepository;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Console CRUD surface for {@link JobNotificationRule}s — "when jobs of this
 * type park as FAILED, message these numbers". Same org-member RS256 family and
 * reactive contract as {@link OrgAsyncJobsConsoleResource}: it lives under
 * {@code /integrations/console/…} so the dual-JWT path matcher never routes it
 * to HS256/M2M verification, tenant context is resolved eagerly on the event
 * loop and the blocking repository runs on the worker pool.
 */
@Path("/api/v1/orgs/{organizationId}/integrations/console/notification-rules")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Job Notification Rules", description = "Per-job-type failure-notification configuration")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgJobNotificationRulesResource {

    private static final String ERROR_KEY = "error";
    private static final Pattern E164 = Pattern.compile("^\\+[1-9]\\d{7,14}$");
    private static final int MAX_RECIPIENTS = 20;
    private static final int MAX_JOB_TYPE_LENGTH = 64;

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final JobNotificationRuleRepository repository;

    @Inject
    public OrgJobNotificationRulesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            JobNotificationRuleRepository repository) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.repository = repository;
    }

    @GET
    @Operation(summary = "List the org's failure-notification rules")
    public Uni<Response> list(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> Response.ok(repository.list(tenant)).build());
    }

    @PUT
    @Path("/{jobType}")
    @Operation(summary = "Create or replace the rule for a job type")
    public Uni<Response> upsert(
            @PathParam("organizationId") String organizationId,
            @PathParam("jobType") String jobType,
            NotificationRuleRequest request) {
        String tenant = tenantCode(organizationId);
        String error = validate(jobType, request);
        if (error != null) {
            return Uni.createFrom().item(errorResponse(Response.Status.BAD_REQUEST, error));
        }
        JobNotificationRule rule = new JobNotificationRule(
                null, tenant, jobType, request.channelOrDefault(),
                List.copyOf(request.recipients()),
                request.enabledOrDefault(), request.throttleSecondsOrDefault(),
                blankToNull(request.templateName()), blankToNull(request.language()),
                null, null, null);
        return onWorker(() -> Response.ok(repository.upsert(rule)).build());
    }

    @DELETE
    @Path("/{jobType}")
    @Operation(summary = "Delete the rule for a job type")
    public Uni<Response> delete(
            @PathParam("organizationId") String organizationId,
            @PathParam("jobType") String jobType,
            @QueryParam("channel") @DefaultValue(JobNotificationRule.CHANNEL_WHATSAPP) String channel) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> repository.delete(tenant, jobType, channel)
                ? Response.noContent().build()
                : errorResponse(Response.Status.NOT_FOUND, "No rule for job type: " + jobType));
    }

    private static String validate(String jobType, NotificationRuleRequest request) {
        if (jobType == null || jobType.isBlank() || jobType.length() > MAX_JOB_TYPE_LENGTH) {
            return "jobType must be 1-" + MAX_JOB_TYPE_LENGTH + " characters";
        }
        if (JobFailureNotificationFeature.JOB_TYPE.equals(jobType)) {
            // The park hook never matches this type either — a rule here would
            // silently do nothing, so reject it loudly instead.
            return "Rules cannot target the notification job type itself";
        }
        if (request == null || request.recipients() == null || request.recipients().isEmpty()) {
            return "recipients must contain at least one E.164 phone number";
        }
        if (request.recipients().size() > MAX_RECIPIENTS) {
            return "recipients must contain at most " + MAX_RECIPIENTS + " numbers";
        }
        for (String recipient : request.recipients()) {
            if (recipient == null || !E164.matcher(recipient).matches()) {
                return "recipients must be full E.164 numbers (e.g. +56912345678), got: " + recipient;
            }
        }
        if (request.throttleSeconds() != null && request.throttleSeconds() < 0) {
            return "throttleSeconds must be >= 0";
        }
        if (!JobNotificationRule.CHANNEL_WHATSAPP.equals(request.channelOrDefault())) {
            return "channel must be 'whatsapp'";
        }
        return null;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    /** Runs a blocking supplier on the worker pool (same contract as the jobs console resource). */
    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private String tenantCode(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(
                    errorResponse(Response.Status.FORBIDDEN, "Organization context does not match request path"));
        }
        return tenantContext.getTenantCode() != null ? tenantContext.getTenantCode() : tenantContext.getClientId();
    }

    private static Response errorResponse(Response.Status status, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of(ERROR_KEY, message != null ? message : status.getReasonPhrase()))
                .build();
    }
}

package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.dto.IntegrationEventRequest;
import com.microboxlabs.miot.integrations.service.IntegrationEventIntakeService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Where producers report that something happened.
 *
 * <p>Deliberately <b>not</b> owner-gated, unlike the bindings resource. Configuring which
 * channel receives a verdict is an administrative act; reporting that a reviewer approved
 * something is ordinary work done by whatever service runs the workflow. Requiring org-owner
 * rights here would mean ECM had to hold them.
 *
 * <p>The producer stays ignorant of integrations: it says what happened and this decides
 * whether anything listens, so a new channel can be bound without a producer deploy.
 */
@Path("/api/v1/orgs/{organizationId}/integrations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Integration Events", description = "Report an event for bound channels to dispatch")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgIntegrationEventsResource {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final IntegrationEventIntakeService intake;

    @Inject
    public OrgIntegrationEventsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            IntegrationEventIntakeService intake) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.intake = intake;
    }

    @POST
    @Path("/events")
    @Operation(summary = "Report an event; enqueues one dispatch job per matching binding")
    public Uni<Response> accept(
            @PathParam("organizationId") String organizationId,
            IntegrationEventRequest request) {
        String tenant = tenantClientId(organizationId);
        return onWorker(() -> {
            try {
                List<String> jobIds = intake.accept(tenant, request);
                // 202 with the jobs it created; 204 when nothing is bound to this event, which
                // is a normal outcome and not an error the producer should react to.
                return jobIds.isEmpty()
                        ? Response.noContent().build()
                        : Response.accepted(Map.of("jobIds", jobIds)).build();
            } catch (IllegalArgumentException e) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(Map.of("error", String.valueOf(e.getMessage())))
                        .build();
            }
        });
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private String tenantClientId(String organizationId) {
        if (!Objects.equals(organizationContext.getOrganizationId(), organizationId)) {
            throw new WebApplicationException(
                    "Organization context does not match the request path", Response.Status.FORBIDDEN);
        }
        return tenantContext.getTenantCode() != null
                ? tenantContext.getTenantCode()
                : tenantContext.getClientId();
    }
}

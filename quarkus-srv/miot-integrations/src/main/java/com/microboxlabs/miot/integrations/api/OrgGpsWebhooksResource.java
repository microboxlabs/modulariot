package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.dto.CreateGpsWebhookRequest;
import com.microboxlabs.miot.integrations.dto.UpdateGpsWebhookRequest;
import com.microboxlabs.miot.integrations.service.GpsWebhookSubscriptionService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
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
 * Org-scoped GPS webhook subscription control plane.
 *
 * <p>Same event-loop / worker-pool pattern as
 * {@link OrgIntegrationConnectionsResource}: resolve tenant on the event loop,
 * run blocking JDBC-style repository work on the worker pool.
 */
@Path("/api/v1/orgs/{organizationId}/integrations/gps-webhooks")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "GPS Webhooks", description = "Tenant-owned GPS position webhook subscriptions with filter criteria")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgGpsWebhooksResource {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final GpsWebhookSubscriptionService service;

    @Inject
    public OrgGpsWebhooksResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            GpsWebhookSubscriptionService service) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.service = service;
    }

    @GET
    @Operation(summary = "List GPS webhook subscriptions")
    public Uni<Response> list(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> Response.ok(service.list(tenant)).build());
    }

    @POST
    @Operation(summary = "Create a GPS webhook subscription")
    public Uni<Response> create(
            @PathParam("organizationId") String organizationId,
            CreateGpsWebhookRequest req) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> {
            try {
                return Response.status(Response.Status.CREATED)
                        .entity(service.create(tenant, req))
                        .build();
            } catch (IllegalArgumentException e) {
                return badRequest(e.getMessage());
            }
        });
    }

    @GET
    @Path("/{subscriptionId}")
    @Operation(summary = "Get a GPS webhook subscription")
    public Uni<Response> get(
            @PathParam("organizationId") String organizationId,
            @PathParam("subscriptionId") String subscriptionId) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> {
            var body = service.get(tenant, subscriptionId);
            return body == null
                    ? Response.status(Response.Status.NOT_FOUND).build()
                    : Response.ok(body).build();
        });
    }

    @PATCH
    @Path("/{subscriptionId}")
    @Operation(summary = "Update a GPS webhook subscription (partial)")
    public Uni<Response> update(
            @PathParam("organizationId") String organizationId,
            @PathParam("subscriptionId") String subscriptionId,
            UpdateGpsWebhookRequest req) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> {
            try {
                var body = service.update(tenant, subscriptionId, req);
                return body == null
                        ? Response.status(Response.Status.NOT_FOUND).build()
                        : Response.ok(body).build();
            } catch (IllegalArgumentException e) {
                return badRequest(e.getMessage());
            }
        });
    }

    @DELETE
    @Path("/{subscriptionId}")
    @Operation(summary = "Soft-delete a GPS webhook subscription")
    public Uni<Response> delete(
            @PathParam("organizationId") String organizationId,
            @PathParam("subscriptionId") String subscriptionId) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> service.delete(tenant, subscriptionId)
                ? Response.noContent().build()
                : Response.status(Response.Status.NOT_FOUND).build());
    }

    @POST
    @Path("/{subscriptionId}/test")
    @Operation(summary = "Send a synthetic sample payload to the webhook URL")
    public Uni<Response> test(
            @PathParam("organizationId") String organizationId,
            @PathParam("subscriptionId") String subscriptionId) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> Response.ok(service.test(tenant, subscriptionId)).build());
    }

    @GET
    @Path("/{subscriptionId}/deliveries")
    @Operation(summary = "List recent delivery attempts for a subscription")
    public Uni<Response> listDeliveries(
            @PathParam("organizationId") String organizationId,
            @PathParam("subscriptionId") String subscriptionId,
            @QueryParam("limit") @DefaultValue("50") int limit) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> {
            var body = service.listDeliveries(tenant, subscriptionId, limit);
            return body == null
                    ? Response.status(Response.Status.NOT_FOUND).build()
                    : Response.ok(body).build();
        });
    }

    @POST
    @Path("/{subscriptionId}/recompile-filters")
    @Operation(summary = "Recompile filter membership for a subscription")
    public Uni<Response> recompile(
            @PathParam("organizationId") String organizationId,
            @PathParam("subscriptionId") String subscriptionId) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> {
            try {
                var body = service.recompile(tenant, subscriptionId);
                return body == null
                        ? Response.status(Response.Status.NOT_FOUND).build()
                        : Response.ok(body).build();
            } catch (IllegalArgumentException e) {
                return badRequest(e.getMessage());
            }
        });
    }

    private static Response badRequest(String message) {
        return Response.status(Response.Status.BAD_REQUEST)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", message))
                .build();
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private String tenantCode(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(Response.status(Response.Status.FORBIDDEN)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(Map.of("error", "Organization context does not match request path"))
                    .build());
        }
        return tenantContext.getTenantCode() != null ? tenantContext.getTenantCode() : tenantContext.getClientId();
    }
}

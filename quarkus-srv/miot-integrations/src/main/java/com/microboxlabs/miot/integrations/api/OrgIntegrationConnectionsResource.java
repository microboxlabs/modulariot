package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationOperationRequest;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Org-scoped endpoints return {@link Uni} so the request runs on the Vert.x
 * event loop: {@code OrganizationRequestFilter} uses Hibernate Reactive and
 * asserts the event-loop thread. A synchronous ({@code Response}-returning)
 * resource is treated as blocking and dispatched to a worker thread, which made
 * the reactive filter fail with HR000068 once exercised. The blocking
 * {@link IntegrationConnectionService} call is offloaded to the worker pool via
 * {@link #onWorker}, with the tenant code resolved eagerly on the event loop.
 */
@Path("/api/v1/orgs/{organizationId}/integrations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Integration Connections", description = "External API connections and their endpoint operations")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgIntegrationConnectionsResource {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final OrganizationRoleService roleService;
    private final IntegrationConnectionService service;

    @Inject
    public OrgIntegrationConnectionsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            IntegrationConnectionService service) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.roleService = roleService;
        this.service = service;
    }

    @GET
    @Path("/connections")
    @Operation(summary = "List integration connections")
    public Uni<Response> listConnections(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId,
                () -> Response.ok(service.listConnections(tenant)).build());
    }

    @POST
    @Path("/connections")
    @Operation(summary = "Create an integration connection")
    public Uni<Response> createConnection(
            @PathParam("organizationId") String organizationId,
            CreateIntegrationConnectionRequest req) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> Response.status(Response.Status.CREATED)
                .entity(service.createConnection(tenant, req))
                .build());
    }

    @GET
    @Path("/connections/{connectionId}")
    @Operation(summary = "Get an integration connection")
    public Uni<Response> getConnection(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> {
            var connection = service.getConnection(tenant, connectionId);
            return connection == null
                    ? Response.status(Response.Status.NOT_FOUND).build()
                    : Response.ok(connection).build();
        });
    }

    @PATCH
    @Path("/connections/{connectionId}")
    @Operation(summary = "Update an integration connection (partial)")
    public Uni<Response> updateConnection(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId,
            UpdateIntegrationConnectionRequest req) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> {
            var connection = service.updateConnection(tenant, connectionId, req);
            return connection == null
                    ? Response.status(Response.Status.NOT_FOUND).build()
                    : Response.ok(connection).build();
        });
    }

    @DELETE
    @Path("/connections/{connectionId}")
    @Operation(summary = "Delete an integration connection (refused while bindings use it)")
    public Uni<Response> deleteConnection(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> {
            try {
                return service.deleteConnection(tenant, connectionId)
                        ? Response.noContent().build()
                        : Response.status(Response.Status.NOT_FOUND).build();
            } catch (IllegalStateException e) {
                // A connection still backing review bindings cannot be removed without orphaning them.
                return Response.status(Response.Status.CONFLICT)
                        .type(MediaType.APPLICATION_JSON)
                        .entity(Map.of("error", e.getMessage()))
                        .build();
            }
        });
    }

    @POST
    @Path("/connections/{connectionId}/test")
    @Operation(summary = "Test an integration connection")
    public Uni<Response> testConnection(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId,
            ConnectionTestRequest req) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId,
                () -> Response.ok(service.testConnection(tenant, connectionId, req)).build());
    }

    @GET
    @Path("/connections/{connectionId}/operations")
    @Operation(summary = "List integration operations")
    public Uni<Response> listOperations(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId,
                () -> Response.ok(service.listOperations(tenant, connectionId)).build());
    }

    @POST
    @Path("/connections/{connectionId}/operations")
    @Operation(summary = "Create an integration operation")
    public Uni<Response> createOperation(
            @PathParam("organizationId") String organizationId,
            @PathParam("connectionId") String connectionId,
            CreateIntegrationOperationRequest req) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> {
            var operation = service.addOperation(tenant, connectionId, req);
            return operation == null
                    ? Response.status(Response.Status.NOT_FOUND).build()
                    : Response.status(Response.Status.CREATED).entity(operation).build();
        });
    }

    /**
     * Runs a blocking supplier on the worker pool so this non-blocking endpoint
     * keeps the request on the event loop (required by the reactive org filter).
     */
    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private <T> Uni<T> ownerWork(String organizationId, Supplier<T> work) {
        return roleService.requireOwner(organizationId)
                .flatMap(ignored -> onWorker(work));
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

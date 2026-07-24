package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.integrations.dto.UpsertIntegrationEventBindingRequest;
import com.microboxlabs.miot.integrations.service.IntegrationEventBindingService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
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
 * Org-scoped endpoints return {@link Uni} so the request runs on the Vert.x event loop:
 * {@code OrganizationRequestFilter} uses Hibernate Reactive and asserts the event-loop
 * thread. The blocking service call is offloaded via {@link #onWorker}, with the tenant
 * resolved eagerly on the event loop — the same shape as the connections resource.
 */
@Path("/api/v1/orgs/{organizationId}/integrations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Integration Bindings",
        description = "Which events dispatch to which channel, and how their payload is mapped")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgIntegrationBindingsResource {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final OrganizationRoleService roleService;
    private final IntegrationEventBindingService service;

    @Inject
    public OrgIntegrationBindingsResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            IntegrationEventBindingService service) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.roleService = roleService;
        this.service = service;
    }

    @GET
    @Path("/bindings")
    @Operation(summary = "List event bindings visible to this organization (its own and its parent's)")
    public Uni<Response> list(@PathParam("organizationId") String organizationId) {
        String tenant = tenantClientId(organizationId);
        String org = orgSlug();
        return ownerWork(organizationId, () -> Response.ok(service.list(tenant, org)).build());
    }

    @GET
    @Path("/bindings/{bindingId}")
    @Operation(summary = "Get one event binding")
    public Uni<Response> get(
            @PathParam("organizationId") String organizationId,
            @PathParam("bindingId") String bindingId) {
        String tenant = tenantClientId(organizationId);
        String org = orgSlug();
        return ownerWork(organizationId, () -> {
            var binding = service.get(tenant, org, bindingId);
            return binding == null
                    ? Response.status(Response.Status.NOT_FOUND).build()
                    : Response.ok(binding).build();
        });
    }

    @PUT
    @Path("/bindings")
    @Operation(summary = "Create or replace a binding, addressed by event + scope + connection")
    public Uni<Response> upsert(
            @PathParam("organizationId") String organizationId,
            UpsertIntegrationEventBindingRequest request) {
        String tenant = tenantClientId(organizationId);
        String org = orgSlug();
        String actor = organizationContext.getUserEmail();
        return ownerWork(organizationId, () -> {
            try {
                return Response.ok(service.upsert(tenant, org, request, actor)).build();
            } catch (IllegalArgumentException e) {
                return badRequest(e);
            }
        });
    }

    @DELETE
    @Path("/bindings/{bindingId}")
    @Operation(summary = "Remove a binding this organization owns")
    public Uni<Response> delete(
            @PathParam("organizationId") String organizationId,
            @PathParam("bindingId") String bindingId) {
        String tenant = tenantClientId(organizationId);
        String org = orgSlug();
        String actor = organizationContext.getUserEmail();
        return ownerWork(organizationId, () -> service.delete(tenant, org, bindingId, actor)
                // A binding inherited from a parent is visible but not this org's to remove,
                // which is a 404 rather than a 403: it does not exist as *their* binding.
                ? Response.noContent().build()
                : Response.status(Response.Status.NOT_FOUND).build());
    }

    @GET
    @Path("/dispatch-targets")
    @Operation(summary = "Bindable channels with each operation's field contract")
    public Uni<Response> dispatchTargets(@PathParam("organizationId") String organizationId) {
        String tenant = tenantClientId(organizationId);
        return ownerWork(organizationId, () -> Response.ok(service.dispatchTargets(tenant)).build());
    }

    @POST
    @Path("/bindings/preview")
    @Operation(summary = "Render a candidate mapping against a sample context without storing it")
    public Uni<Response> preview(
            @PathParam("organizationId") String organizationId,
            PreviewRequest request) {
        String tenant = tenantClientId(organizationId);
        return ownerWork(organizationId, () -> {
            try {
                return Response.ok(service.preview(
                        tenant,
                        request == null ? null : request.binding(),
                        request == null ? Map.of() : request.context())).build();
            } catch (IllegalArgumentException e) {
                return badRequest(e);
            }
        });
    }

    /** A candidate binding plus the context to render it against. */
    public record PreviewRequest(
            UpsertIntegrationEventBindingRequest binding,
            Map<String, Object> context) {
    }

    private static Response badRequest(IllegalArgumentException e) {
        return Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("error", String.valueOf(e.getMessage())))
                .build();
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private <T> Uni<T> ownerWork(String organizationId, Supplier<T> work) {
        return roleService.requireOwner(organizationId).flatMap(ignored -> onWorker(work));
    }

    private String orgSlug() {
        return organizationContext.getOrganizationId();
    }

    /**
     * The org's Auth0 M2M client — what the rest of this schema stores as {@code tenant_code}.
     * Resolved eagerly on the event loop, before any worker hop.
     */
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

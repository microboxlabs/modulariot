package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationTemplateRequest;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationTemplateRequest;
import com.microboxlabs.miot.integrations.service.IntegrationTemplateService;
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
 * Integration templates: the operator-defined types connections are created from. Mirrors
 * {@link OrgIntegrationConnectionsResource} — org-scoped, owner-gated, and returning
 * {@link Uni} so the request stays on the Vert.x event loop while the blocking service call is
 * offloaded to the worker pool.
 */
@Path("/api/v1/orgs/{organizationId}/integrations/templates")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Integration Templates", description = "Reusable integration types (contracts) instances are created from")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgIntegrationTemplatesResource {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final OrganizationRoleService roleService;
    private final IntegrationTemplateService service;

    @Inject
    public OrgIntegrationTemplatesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            IntegrationTemplateService service) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.roleService = roleService;
        this.service = service;
    }

    @GET
    @Operation(summary = "List integration templates")
    public Uni<Response> listTemplates(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId,
                () -> Response.ok(service.listTemplates(tenant)).build());
    }

    @POST
    @Operation(summary = "Create an integration template")
    public Uni<Response> createTemplate(
            @PathParam("organizationId") String organizationId,
            CreateIntegrationTemplateRequest req) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> Response.status(Response.Status.CREATED)
                .entity(service.createTemplate(tenant, req))
                .build());
    }

    @GET
    @Path("/{templateId}")
    @Operation(summary = "Get an integration template")
    public Uni<Response> getTemplate(
            @PathParam("organizationId") String organizationId,
            @PathParam("templateId") String templateId) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> {
            var template = service.getTemplate(tenant, templateId);
            return template == null
                    ? Response.status(Response.Status.NOT_FOUND).build()
                    : Response.ok(template).build();
        });
    }

    @PATCH
    @Path("/{templateId}")
    @Operation(summary = "Update an integration template (partial)")
    public Uni<Response> updateTemplate(
            @PathParam("organizationId") String organizationId,
            @PathParam("templateId") String templateId,
            UpdateIntegrationTemplateRequest req) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> {
            var template = service.updateTemplate(tenant, templateId, req);
            return template == null
                    ? Response.status(Response.Status.NOT_FOUND).build()
                    : Response.ok(template).build();
        });
    }

    @DELETE
    @Path("/{templateId}")
    @Operation(summary = "Delete an integration template (refused while instances exist)")
    public Uni<Response> deleteTemplate(
            @PathParam("organizationId") String organizationId,
            @PathParam("templateId") String templateId) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> {
            try {
                return service.deleteTemplate(tenant, templateId)
                        ? Response.noContent().build()
                        : Response.status(Response.Status.NOT_FOUND).build();
            } catch (IllegalStateException e) {
                // A template still backing connections cannot be removed without orphaning them.
                return Response.status(Response.Status.CONFLICT)
                        .type(MediaType.APPLICATION_JSON)
                        .entity(Map.of("error", e.getMessage()))
                        .build();
            }
        });
    }

    /**
     * Runs a blocking supplier on the worker pool so this non-blocking endpoint keeps the
     * request on the event loop (required by the reactive org filter).
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

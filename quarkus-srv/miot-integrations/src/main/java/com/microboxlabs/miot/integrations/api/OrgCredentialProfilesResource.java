package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CredentialTestRequest;
import com.microboxlabs.miot.integrations.dto.UpdateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.service.CredentialInUseException;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
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
 * Credentials control plane: reusable identities configured once per org and referenced
 * from connections, jobs and channels.
 *
 * <p>Owner-gated, like the connection endpoints these were split out of: a credential is
 * a live secret, so reading or rotating one is not something every org member may do.
 *
 * <p>Same event-loop / worker-pool split as {@link OrgGpsWebhooksResource} — the tenant
 * and the acting user are resolved on the event loop, where the request context is live,
 * and the blocking service call runs on the worker pool.
 */
@Path("/api/v1/orgs/{organizationId}/integrations/credential-profiles")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Credentials", description = "Reusable credentials (client credentials, tokens, keys) per organization")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgCredentialProfilesResource {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final OrganizationRoleService roleService;
    private final CredentialProfileService service;

    @Inject
    public OrgCredentialProfilesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            CredentialProfileService service) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.roleService = roleService;
        this.service = service;
    }

    @GET
    @Operation(summary = "List credentials")
    public Uni<Response> list(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> Response.ok(service.list(tenant)).build());
    }

    @POST
    @Operation(summary = "Create a credential")
    public Uni<Response> create(
            @PathParam("organizationId") String organizationId,
            CreateCredentialProfileRequest req) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> {
            try {
                return Response.status(Response.Status.CREATED)
                        .entity(service.create(tenant, actor, req))
                        .build();
            } catch (IllegalArgumentException e) {
                return badRequest(e.getMessage());
            }
        });
    }

    /**
     * Exercises a credential that has not been saved yet, so the operator finds out the
     * secret is wrong before storing it. Distinct path depth from {@code /{id}/test}, so
     * nothing has to disambiguate the two.
     */
    @POST
    @Path("/test")
    @Operation(summary = "Test an unsaved credential configuration")
    public Uni<Response> testConfig(
            @PathParam("organizationId") String organizationId,
            CredentialTestRequest req) {
        tenantCode(organizationId);
        return ownerWork(organizationId, () -> {
            try {
                return Response.ok(service.testConfig(req)).build();
            } catch (IllegalArgumentException e) {
                return badRequest(e.getMessage());
            }
        });
    }

    @GET
    @Path("/{credentialId}")
    @Operation(summary = "Get a credential")
    public Uni<Response> get(
            @PathParam("organizationId") String organizationId,
            @PathParam("credentialId") String credentialId) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> {
            var body = service.get(tenant, credentialId);
            return body == null
                    ? Response.status(Response.Status.NOT_FOUND).build()
                    : Response.ok(body).build();
        });
    }

    @PATCH
    @Path("/{credentialId}")
    @Operation(summary = "Update a credential (partial)")
    public Uni<Response> update(
            @PathParam("organizationId") String organizationId,
            @PathParam("credentialId") String credentialId,
            UpdateCredentialProfileRequest req) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> {
            try {
                var body = service.update(tenant, actor, credentialId, req);
                return body == null
                        ? Response.status(Response.Status.NOT_FOUND).build()
                        : Response.ok(body).build();
            } catch (IllegalArgumentException e) {
                return badRequest(e.getMessage());
            }
        });
    }

    @DELETE
    @Path("/{credentialId}")
    @Operation(summary = "Soft-delete a credential; 409 while it is still referenced")
    public Uni<Response> delete(
            @PathParam("organizationId") String organizationId,
            @PathParam("credentialId") String credentialId,
            @QueryParam("force") @DefaultValue("false") boolean force) {
        String tenant = tenantCode(organizationId);
        String actor = actor();
        return ownerWork(organizationId, () -> {
            try {
                return service.delete(tenant, actor, credentialId, force)
                        ? Response.noContent().build()
                        : Response.status(Response.Status.NOT_FOUND).build();
            } catch (CredentialInUseException e) {
                return Response.status(Response.Status.CONFLICT)
                        .type(MediaType.APPLICATION_JSON)
                        .entity(Map.of("error", e.getMessage(), "usedBy", e.usages()))
                        .build();
            }
        });
    }

    @POST
    @Path("/{credentialId}/test")
    @Operation(summary = "Test a stored credential and record the outcome")
    public Uni<Response> test(
            @PathParam("organizationId") String organizationId,
            @PathParam("credentialId") String credentialId) {
        String tenant = tenantCode(organizationId);
        return ownerWork(organizationId, () -> {
            var body = service.test(tenant, credentialId);
            return body == null
                    ? Response.status(Response.Status.NOT_FOUND).build()
                    : Response.ok(body).build();
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

    /** Owner check on the event loop, then the blocking work on the worker pool. */
    private <T> Uni<T> ownerWork(String organizationId, Supplier<T> work) {
        return roleService.requireOwner(organizationId)
                .flatMap(ignored -> onWorker(work));
    }

    /** Who is rotating this secret. Read on the event loop — the worker has no request context. */
    private String actor() {
        return organizationContext.getUserEmail();
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

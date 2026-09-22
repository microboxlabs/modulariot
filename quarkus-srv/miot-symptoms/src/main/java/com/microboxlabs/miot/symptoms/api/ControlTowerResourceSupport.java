package com.microboxlabs.miot.symptoms.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Shared plumbing for the Control Tower resources. Org-scoped endpoints return
 * {@link Uni} so the request stays on the event loop for the reactive
 * {@code OrganizationRequestFilter}; the blocking service call runs on the
 * worker pool. The tenant comes from the resolved organization and the actor
 * from the session, never from the body. Service exceptions map to HTTP:
 * {@link IllegalArgumentException} 400, {@link NoSuchElementException} 404,
 * {@link IllegalStateException} 409.
 */
abstract class ControlTowerResourceSupport {

    static final String BASE_PATH = "/api/v1/orgs/{organizationId}/control-tower";

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final OrganizationRoleService roleService;
    private final SecurityIdentity identity;

    protected ControlTowerResourceSupport(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.roleService = roleService;
        this.identity = identity;
    }

    /** Any member of the organization (the org filter already checked membership). */
    protected Uni<Response> memberWork(Supplier<Response> work) {
        return Uni.createFrom().item(() -> guarded(work))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    /** Organization owners only: settings writes (selectables, deleting contacts). */
    protected Uni<Response> ownerWork(String organizationId, Supplier<Response> work) {
        return roleService.requireOwner(organizationId).flatMap(ignored -> memberWork(work));
    }

    protected String tenantCode(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(Response.status(Response.Status.FORBIDDEN)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(Map.of("error", "Organization context does not match request path"))
                    .build());
        }
        return tenantContext.getTenantCode() != null ? tenantContext.getTenantCode() : tenantContext.getClientId();
    }

    /** The user's email for a session token, the client id for an M2M token. */
    protected String actor() {
        String email = organizationContext.getUserEmail();
        if (email != null && !email.isBlank()) {
            return email;
        }
        if (identity != null && identity.getPrincipal() != null) {
            return identity.getPrincipal().getName();
        }
        return null;
    }

    private static Response guarded(Supplier<Response> work) {
        try {
            return work.get();
        } catch (IllegalArgumentException e) {
            return error(Response.Status.BAD_REQUEST, e.getMessage());
        } catch (NoSuchElementException e) {
            return error(Response.Status.NOT_FOUND, e.getMessage());
        } catch (IllegalStateException e) {
            return error(Response.Status.CONFLICT, e.getMessage());
        }
    }

    protected static Response error(Response.Status status, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", message == null ? status.getReasonPhrase() : message))
                .build();
    }

    protected static long parseSymptomId(String raw) {
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("symptomId must be numeric");
        }
    }
}

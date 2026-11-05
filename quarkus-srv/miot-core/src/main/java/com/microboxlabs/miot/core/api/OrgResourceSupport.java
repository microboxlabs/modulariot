package com.microboxlabs.miot.core.api;

import com.microboxlabs.miot.core.auth.OrganizationAccess;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.IamIdentityAugmentor;
import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.ConfigProvider;

/**
 * Shared plumbing for org-scoped module resources. Endpoints return {@link Uni} so the request
 * stays on the event loop for the reactive {@code OrganizationRequestFilter}; the blocking service
 * call runs on the worker pool. The tenant comes from the resolved organization and the actor from
 * the session, never from the body. Service exceptions map to HTTP:
 * {@link IllegalArgumentException} 400, {@link NoSuchElementException} 404,
 * {@link IllegalStateException} 409; a module maps its own through {@link #unmapped}.
 */
public abstract class OrgResourceSupport {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final OrganizationRoleService roleService;
    private final SecurityIdentity identity;

    protected OrgResourceSupport(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            OrganizationRoleService roleService,
            SecurityIdentity identity) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.roleService = roleService;
        this.identity = identity;
    }

    /** Runs the blocking service call on the worker pool; each endpoint declares its permission. */
    protected Uni<Response> work(Supplier<Response> work) {
        return Uni.createFrom().item(() -> guarded(work))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    /** The caller's access to the organization the request entered. */
    protected Uni<Access> access(String organizationId) {
        return roleService.access(organizationId, caller());
    }

    /** The caller as {@code @PermissionsAllowed} sees it: API key account, user, else the token's client id. */
    protected Caller caller() {
        Caller serviceAccount = IamIdentityAugmentor.serviceAccountOf(identity);
        if (serviceAccount != null) {
            return serviceAccount;
        }
        String email = organizationContext.getUserEmail();
        if (email != null && !email.isBlank()) {
            return Caller.user(email);
        }
        List<String> claims = ConfigProvider.getConfig()
                .getOptionalValues("miot.auth.client-id-claims", String.class)
                .orElse(List.of("aud", "azp"));
        String clientId = OrganizationAccess.clientId(identity, claims);
        return Caller.client(clientId != null ? clientId : tenantContext.getClientId());
    }

    protected String tenantCode(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(
                    error(Response.Status.FORBIDDEN, "Organization context does not match request path"));
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

    protected TenantContext tenantContext() {
        return tenantContext;
    }

    protected OrganizationContext organizationContext() {
        return organizationContext;
    }

    /** The response for a module exception the defaults do not cover; by default it propagates. */
    protected Response unmapped(RuntimeException e) {
        throw e;
    }

    private Response guarded(Supplier<Response> work) {
        try {
            return work.get();
        } catch (IllegalArgumentException e) {
            return error(Response.Status.BAD_REQUEST, e.getMessage());
        } catch (NoSuchElementException e) {
            return error(Response.Status.NOT_FOUND, e.getMessage());
        } catch (IllegalStateException e) {
            return error(Response.Status.CONFLICT, e.getMessage());
        } catch (SecurityException e) {
            return error(Response.Status.FORBIDDEN, e.getMessage());
        } catch (RuntimeException e) {
            return unmapped(e);
        }
    }

    protected static Response error(Response.Status status, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", message == null ? status.getReasonPhrase() : message))
                .build();
    }

    /** Parses an optional numeric query parameter; a malformed one becomes a 400 inside {@link #work}. */
    protected static Integer integer(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(raw.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(field + " must be an integer");
        }
    }

    protected static Long longParam(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(raw.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(field + " must be an integer");
        }
    }

    /** Parses an API id; a malformed one becomes a 400 inside {@link #work}. */
    protected static UUID uuid(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(field + " must be a UUID");
        }
    }
}

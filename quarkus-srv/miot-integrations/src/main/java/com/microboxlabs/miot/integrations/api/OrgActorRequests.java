package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiFunction;

/**
 * The request handling shared by the user-owned resources (stories, links),
 * with the same rules as {@link OrgHarnessThreadsResource}: the path's
 * organization must be the one the filter resolved, the actor is the session's
 * email, the work runs on the worker pool, and a validation failure is a 400.
 */
final class OrgActorRequests {

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final SecurityIdentity identity;

    OrgActorRequests(TenantContext tenantContext, OrganizationContext organizationContext, SecurityIdentity identity) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.identity = identity;
    }

    /** Runs {@code work} with the tenant code and the acting user. */
    Uni<Response> run(String organizationId, BiFunction<String, String, Response> work) {
        String tenant = tenantCode(organizationId);
        String userId = currentUserId();
        if (userId == null || userId.isBlank()) {
            return Uni.createFrom().item(error(Response.Status.UNAUTHORIZED, "no user identity on the request"));
        }
        return Uni.createFrom().item(() -> work.apply(tenant, userId))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> error(Response.Status.BAD_REQUEST, e.getMessage()));
    }

    /** A null entity is "not visible to you", answered as not found. */
    static Response found(Object entity, Response.Status status, String notFound) {
        return entity == null
                ? error(Response.Status.NOT_FOUND, notFound)
                : Response.status(status).entity(entity).build();
    }

    static Response noContentOr404(boolean done, String notFound) {
        return done ? Response.noContent().build() : error(Response.Status.NOT_FOUND, notFound);
    }

    static Response error(Response.Status status, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", message == null ? status.getReasonPhrase() : message))
                .build();
    }

    private String tenantCode(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(
                    error(Response.Status.FORBIDDEN, "Organization context does not match request path"));
        }
        return tenantContext.getTenantCode() != null ? tenantContext.getTenantCode() : tenantContext.getClientId();
    }

    private String currentUserId() {
        String email = organizationContext.getUserEmail();
        if (email != null && !email.isBlank()) {
            return email;
        }
        return identity == null || identity.getPrincipal() == null ? null : identity.getPrincipal().getName();
    }
}

package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.dto.EpisodeRequest;
import com.microboxlabs.miot.integrations.service.EpisodeService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
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
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * User-authed (RS256/JWKS session token — deliberately NOT {@code @M2MAuth},
 * unlike {@code OrgAsyncJobsResource}) endpoint that appends interaction episodes
 * for the semantic-layer learning loop. The app / CLI POST a completed session's
 * signal here; the tenant is resolved from the org path and the actor from the
 * session identity — never trusted from the body. Returns a {@link Uni} so the
 * request stays on the event loop for the reactive org filter, offloading the
 * blocking service call to the worker pool (mirrors
 * {@code OrgIntegrationConnectionsResource}).
 */
@Path("/api/v1/orgs/{organizationId}/interactions")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Interaction Episodes",
        description = "Append-only user<->agent interaction signal for the semantic-layer learning loop")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgInteractionEpisodesResource {

    private final EpisodeService service;
    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final SecurityIdentity identity;

    @Inject
    public OrgInteractionEpisodesResource(
            EpisodeService service,
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            SecurityIdentity identity) {
        this.service = service;
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.identity = identity;
    }

    @POST
    @Path("/episodes")
    @Operation(summary = "Record an interaction episode")
    public Uni<Response> record(
            @PathParam("organizationId") String organizationId,
            EpisodeRequest request) {
        String tenant = tenantCode(organizationId);
        String userId = currentUserId();
        return onWorker(() -> Response.status(Response.Status.CREATED)
                .entity(service.record(tenant, userId, request))
                .build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> errorResponse(Response.Status.BAD_REQUEST, e.getMessage()));
    }

    /**
     * Runs a blocking supplier on the worker pool so this non-blocking endpoint
     * keeps the request on the event loop (required by the reactive org filter).
     */
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

    private String currentUserId() {
        return identity == null || identity.getPrincipal() == null
                ? null
                : identity.getPrincipal().getName();
    }

    private static Response errorResponse(Response.Status status, String message) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", message == null ? status.getReasonPhrase() : message))
                .build();
    }
}

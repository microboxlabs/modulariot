package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.domain.KnowledgeCandidate;
import com.microboxlabs.miot.integrations.dto.CandidateRequest;
import com.microboxlabs.miot.integrations.service.CandidateService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
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
 * User-authed (RS256/JWKS session token — deliberately NOT {@code @M2MAuth})
 * review surface for the semantic-layer learning loop's STAGING store. The app
 * stages candidates here and an authorized reviewer approves/rejects them; the
 * tenant is resolved from the org path and the reviewer from the session identity
 * — never trusted from the body. Approve/reject is the HUMAN GATE: no candidate
 * becomes an authoritative connection card without a decision here. Returns a
 * {@link Uni} so the request stays on the event loop for the reactive org filter,
 * offloading the blocking service call to the worker pool (mirrors
 * {@code OrgInteractionEpisodesResource}).
 */
@Path("/api/v1/orgs/{organizationId}/knowledge")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Knowledge Candidates",
        description = "Human-gated staging store for learned business-semantics facts")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgKnowledgeCandidatesResource {

    private final CandidateService service;
    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final SecurityIdentity identity;

    @Inject
    public OrgKnowledgeCandidatesResource(
            CandidateService service,
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            SecurityIdentity identity) {
        this.service = service;
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.identity = identity;
    }

    @POST
    @Path("/candidates")
    @Operation(summary = "Stage a knowledge candidate for review")
    public Uni<Response> create(
            @PathParam("organizationId") String organizationId,
            CandidateRequest request) {
        String tenant = tenantCode(organizationId);
        String userId = currentUserId();
        return onWorker(() -> Response.status(Response.Status.CREATED)
                .entity(service.create(tenant, userId, request))
                .build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> errorResponse(Response.Status.BAD_REQUEST, e.getMessage()));
    }

    @GET
    @Path("/candidates")
    @Operation(summary = "List knowledge candidates by status (default pending)")
    public Uni<Response> list(
            @PathParam("organizationId") String organizationId,
            @QueryParam("status") @DefaultValue("pending") String status,
            @QueryParam("limit") @DefaultValue("100") int limit) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> Response.ok(service.list(tenant, status, limit)).build())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> errorResponse(Response.Status.BAD_REQUEST, e.getMessage()));
    }

    @POST
    @Path("/candidates/{id}/approve")
    @Operation(summary = "Approve a pending candidate (the human gate)")
    public Uni<Response> approve(
            @PathParam("organizationId") String organizationId,
            @PathParam("id") String id) {
        return review(organizationId, id, "approve");
    }

    @POST
    @Path("/candidates/{id}/reject")
    @Operation(summary = "Reject a pending candidate")
    public Uni<Response> reject(
            @PathParam("organizationId") String organizationId,
            @PathParam("id") String id) {
        return review(organizationId, id, "reject");
    }

    private Uni<Response> review(String organizationId, String id, String decision) {
        String tenant = tenantCode(organizationId);
        String userId = currentUserId();
        return onWorker(() -> {
            KnowledgeCandidate reviewed = service.review(tenant, id, decision, userId);
            if (reviewed == null) {
                return errorResponse(Response.Status.NOT_FOUND,
                        "candidate not found or already reviewed");
            }
            return Response.ok(reviewed).build();
        })
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

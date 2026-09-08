package com.microboxlabs.miot.integrations.api;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.dto.ThreadMessageRequest;
import com.microboxlabs.miot.integrations.dto.ThreadPatchRequest;
import com.microboxlabs.miot.integrations.dto.ThreadShareRequest;
import com.microboxlabs.miot.integrations.dto.ThreadUpsertRequest;
import com.microboxlabs.miot.integrations.service.HarnessThreadService;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
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
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Chat threads behind the harness panel's history. User-authed with the session
 * token, like {@code OrgInteractionEpisodesResource} and unlike the M2M
 * endpoints: a thread belongs to a person, so the actor comes from the session
 * identity and never from the body.
 *
 * <p>Deliberately not under {@code /harness}: that prefix is a root resource in
 * miot-core proxying runs to the harness, and a second root resource extending
 * it would leave the routing to template-precedence rules. The storage lives
 * here next to {@code interaction_episodes} — both are chat surface state, both
 * write JSONB through the reactive client.
 *
 * <p>Returns a {@link Uni} so the request stays on the event loop for the
 * reactive org filter, offloading the blocking service call to the worker pool.
 */
@Path("/api/v1/orgs/{organizationId}/chat/threads")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "Harness Threads", description = "Persistent transcripts for the harness chat panel")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class OrgHarnessThreadsResource {

    private final HarnessThreadService service;
    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final SecurityIdentity identity;

    @Inject
    public OrgHarnessThreadsResource(
            HarnessThreadService service,
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            SecurityIdentity identity) {
        this.service = service;
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.identity = identity;
    }

    @GET
    @Operation(summary = "List the threads visible to the caller")
    public Uni<Response> listThreads(
            @PathParam("organizationId") String organizationId,
            @QueryParam("limit") Integer limit) {
        return withActor(organizationId, (tenant, userId) ->
                Response.ok(service.listVisible(tenant, userId, limit)).build());
    }

    @POST
    @Operation(summary = "Create a thread, or rename one the caller owns")
    public Uni<Response> createThread(
            @PathParam("organizationId") String organizationId,
            ThreadUpsertRequest request) {
        return withActor(organizationId, (tenant, userId) ->
                found(service.create(tenant, userId, request), Response.Status.CREATED));
    }

    @GET
    @Path("/{threadId}")
    @Operation(summary = "Read one thread's metadata")
    public Uni<Response> getThread(
            @PathParam("organizationId") String organizationId,
            @PathParam("threadId") String threadId) {
        return withActor(organizationId, (tenant, userId) ->
                found(service.get(tenant, userId, threadId), Response.Status.OK));
    }

    @PATCH
    @Path("/{threadId}")
    @Operation(summary = "Rename a thread or change when it expires")
    public Uni<Response> patchThread(
            @PathParam("organizationId") String organizationId,
            @PathParam("threadId") String threadId,
            ThreadPatchRequest request) {
        return withActor(organizationId, (tenant, userId) ->
                found(service.patch(tenant, userId, threadId, request), Response.Status.OK));
    }

    @DELETE
    @Path("/{threadId}")
    @Operation(summary = "Delete a thread the caller owns")
    public Uni<Response> deleteThread(
            @PathParam("organizationId") String organizationId,
            @PathParam("threadId") String threadId) {
        return withActor(organizationId, (tenant, userId) ->
                service.delete(tenant, userId, threadId) ? Response.noContent().build() : notFound());
    }

    @GET
    @Path("/{threadId}/messages")
    @Operation(summary = "Replay a thread's messages in append order")
    public Uni<Response> listMessages(
            @PathParam("organizationId") String organizationId,
            @PathParam("threadId") String threadId) {
        return withActor(organizationId, (tenant, userId) ->
                found(service.listMessages(tenant, userId, threadId), Response.Status.OK));
    }

    @POST
    @Path("/{threadId}/messages")
    @Operation(summary = "Append or rewrite one message")
    public Uni<Response> appendMessage(
            @PathParam("organizationId") String organizationId,
            @PathParam("threadId") String threadId,
            ThreadMessageRequest request) {
        return withActor(organizationId, (tenant, userId) ->
                found(service.appendMessage(tenant, userId, threadId, request), Response.Status.CREATED));
    }

    @POST
    @Path("/{threadId}/shares")
    @Operation(summary = "Give one other person read access to a thread")
    public Uni<Response> shareThread(
            @PathParam("organizationId") String organizationId,
            @PathParam("threadId") String threadId,
            ThreadShareRequest request) {
        return withActor(organizationId, (tenant, userId) ->
                found(service.share(tenant, userId, threadId, request), Response.Status.CREATED));
    }

    @DELETE
    @Path("/{threadId}/shares/{principal}")
    @Operation(summary = "Revoke one person's access to a thread")
    public Uni<Response> revokeShare(
            @PathParam("organizationId") String organizationId,
            @PathParam("threadId") String threadId,
            @PathParam("principal") String principal) {
        return withActor(organizationId, (tenant, userId) ->
                service.revokeShare(tenant, userId, threadId, principal)
                        ? Response.noContent().build()
                        : notFound());
    }

    /**
     * Resolves the tenant and the person acting, then runs the work on the
     * worker pool. {@code @Authenticated} guarantees an identity, not that it
     * names anybody: a token carrying neither an email nor a principal name
     * cannot own a thread, and that is a 401 rather than something for the
     * service to guess at.
     */
    private Uni<Response> withActor(String organizationId, BiFunction<String, String, Response> work) {
        String tenant = tenantCode(organizationId);
        String userId = currentUserId();
        if (userId == null || userId.isBlank()) {
            return Uni.createFrom().item(
                    errorResponse(Response.Status.UNAUTHORIZED, "no user identity on the request"));
        }
        return guarded(() -> work.apply(tenant, userId));
    }

    /**
     * Runs a blocking supplier on the worker pool and maps validation failures
     * to 400, keeping this non-blocking endpoint on the event loop (required by
     * the reactive org filter).
     */
    private static Uni<Response> guarded(Supplier<Response> work) {
        return Uni.createFrom().item(work)
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .onFailure(IllegalArgumentException.class)
                .recoverWithItem(e -> errorResponse(Response.Status.BAD_REQUEST, e.getMessage()));
    }

    /**
     * A null body means "you cannot see this", whether because the thread is
     * gone or because it is somebody else's — the API answers both the same way
     * rather than confirming that an id exists.
     */
    private static Response found(Object entity, Response.Status status) {
        return entity == null ? notFound() : Response.status(status).entity(entity).build();
    }

    private static Response notFound() {
        return errorResponse(Response.Status.NOT_FOUND, "thread not found");
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

    /**
     * The person a thread belongs to, and the value another owner types to
     * share one with them — so it has to be the email the org filter already
     * resolved (JWT {@code email} claim, or the dev impersonation header), not
     * the principal name, which is an opaque subject nobody can be expected to
     * know. Falls back to the principal only so a token without the claim
     * still gets its own private threads rather than sharing one identity.
     */
    private String currentUserId() {
        String email = organizationContext.getUserEmail();
        if (email != null && !email.isBlank()) {
            return email;
        }
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

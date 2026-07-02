package com.microboxlabs.miot.conversational.api;

import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService;
import com.microboxlabs.miot.core.auth.M2MAuth;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
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
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Service-to-service (M2M) WhatsApp send, for upstream processes that own the *when* —
 * e.g. ecm-coordinator firing POD notifications on delivery transitions (plan §4 / A.1).
 *
 * <p>This is a thin sibling of {@link OrgWhatsAppMessagesResource}: it delegates to the same
 * {@link WhatsAppMessagingService#send}. It exists as a separate resource only because
 * {@code @M2MAuth} switches its whole {@code @Path} subtree to HS256 verification
 * (see {@code DualJwtAuthMechanism}). Keeping it on a distinct {@code …/whatsapp/outbound}
 * path leaves the user-facing {@code …/whatsapp/*} endpoints (Control Tower, Conversations
 * inbox) on RS256 user tokens.
 *
 * <p>Attribution: the transport principal here is a machine, so the message is attributed to
 * the request's {@code actor} (the operator who triggered it upstream); when absent it falls
 * back to the calling principal. A caller cannot impersonate a user on the RS256 path — that
 * one ignores {@code actor} and uses the authenticated user.
 */
@Path("/api/v1/orgs/{organizationId}/whatsapp/outbound")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "WhatsApp Channel (M2M)", description = "Service-to-service WhatsApp send for upstream processes")
@SecurityRequirement(name = "oidc")
@Authenticated
@M2MAuth
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class OrgWhatsAppOutboundResource {

    private static final String ERROR = "error";

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final SecurityIdentity identity;
    private final WhatsAppMessagingService messagingService;

    @Inject
    public OrgWhatsAppOutboundResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            SecurityIdentity identity,
            WhatsAppMessagingService messagingService) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.identity = identity;
        this.messagingService = messagingService;
    }

    @POST
    @Path("/messages")
    @Operation(summary = "Send an outbound WhatsApp message as a service (M2M), attributed to an upstream actor")
    public Uni<Response> sendMessage(
            @PathParam("organizationId") String organizationId,
            SendWhatsAppMessageRequest request) {
        String tenant = tenantCode(organizationId);
        String sentBy = resolveActor(request, currentPrincipal());
        return onWorker(() -> {
            try {
                Message message = messagingService.send(tenant, request, sentBy);
                Response.Status code = message.status() == MessageStatus.FAILED
                        ? Response.Status.BAD_GATEWAY
                        : Response.Status.CREATED;
                return Response.status(code).entity(message).build();
            } catch (ConnectionResolutionException e) {
                return Response.status(Response.Status.CONFLICT).entity(Map.of(ERROR, e.getMessage())).build();
            } catch (IllegalArgumentException e) {
                return Response.status(Response.Status.BAD_REQUEST).entity(Map.of(ERROR, e.getMessage())).build();
            }
        });
    }

    /**
     * Who the message is attributed to: the request's {@code actor} (the upstream operator)
     * when provided, otherwise the calling principal (the M2M client). Package-private and
     * static so it is unit-testable without the request infrastructure.
     */
    static String resolveActor(SendWhatsAppMessageRequest request, String principal) {
        String actor = request == null ? null : request.actor();
        return actor != null && !actor.isBlank() ? actor : principal;
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private String currentPrincipal() {
        return identity == null || identity.getPrincipal() == null ? null : identity.getPrincipal().getName();
    }

    private String tenantCode(String organizationId) {
        if (!Objects.equals(organizationId, organizationContext.getOrganizationId())) {
            throw new WebApplicationException(Response.status(Response.Status.FORBIDDEN)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(Map.of(ERROR, "Organization context does not match request path"))
                    .build());
        }
        return tenantContext.getTenantCode() != null ? tenantContext.getTenantCode() : tenantContext.getClientId();
    }
}

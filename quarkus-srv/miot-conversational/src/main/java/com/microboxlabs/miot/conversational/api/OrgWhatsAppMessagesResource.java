package com.microboxlabs.miot.conversational.api;

import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import com.microboxlabs.miot.conversational.persistence.MessageRepository;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService;
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
import jakarta.ws.rs.GET;
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
 * Org-scoped WhatsApp channel endpoints: send a message and read back the message pool.
 * Mirrors the reactive pattern of the integrations resource — endpoints return {@link Uni}
 * to stay on the event loop (required by the reactive org filter) and offload the blocking
 * repository / HTTP work to the worker pool via {@link #onWorker}.
 */
@Path("/api/v1/orgs/{organizationId}/whatsapp")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Tag(name = "WhatsApp Channel", description = "Outbound WhatsApp messages and the conversation message pool")
@SecurityRequirement(name = "oidc")
@Authenticated
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class OrgWhatsAppMessagesResource {

    private static final int CONVERSATIONS_LIMIT = 200;
    private static final int MESSAGES_LIMIT = 200;
    private static final String ERROR = "error";

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final SecurityIdentity identity;
    private final WhatsAppMessagingService messagingService;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    @Inject
    public OrgWhatsAppMessagesResource(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            SecurityIdentity identity,
            WhatsAppMessagingService messagingService,
            ConversationRepository conversationRepository,
            MessageRepository messageRepository) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.identity = identity;
        this.messagingService = messagingService;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    @POST
    @Path("/messages")
    @Operation(summary = "Send an outbound WhatsApp message (text or template)")
    public Uni<Response> sendMessage(
            @PathParam("organizationId") String organizationId,
            SendWhatsAppMessageRequest request) {
        String tenant = tenantCode(organizationId);
        String userId = currentUserId();
        return onWorker(() -> {
            try {
                Message message = messagingService.send(tenant, request, userId);
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

    @GET
    @Path("/conversations")
    @Operation(summary = "List WhatsApp conversations (most recently active first)")
    public Uni<Response> listConversations(@PathParam("organizationId") String organizationId) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> Response.ok(conversationRepository.listByTenant(tenant, CONVERSATIONS_LIMIT)).build());
    }

    @GET
    @Path("/conversations/{conversationId}/messages")
    @Operation(summary = "List the message timeline of a conversation")
    public Uni<Response> listMessages(
            @PathParam("organizationId") String organizationId,
            @PathParam("conversationId") String conversationId) {
        String tenant = tenantCode(organizationId);
        return onWorker(() -> {
            Conversation conversation = conversationRepository.findByTenantAndId(tenant, conversationId);
            if (conversation == null) {
                return Response.status(Response.Status.NOT_FOUND).build();
            }
            return Response.ok(messageRepository.listByConversation(conversation.id(), MESSAGES_LIMIT)).build();
        });
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private String currentUserId() {
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

package com.microboxlabs.miot.conversational.service;

import static com.microboxlabs.miot.conversational.service.WhatsAppMessagingService.CONNECTION_TENANT;
import static com.microboxlabs.miot.conversational.service.WhatsAppMessagingService.PLATFORM_TENANT;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import com.microboxlabs.miot.conversational.persistence.MessageRepository;
import com.microboxlabs.miot.conversational.persistence.MessageRepository.OutboundRef;
import java.time.OffsetDateTime;
import org.jboss.logging.Logger;

/**
 * Chooses the organization and conversation of a message received on the platform's WhatsApp number, which
 * every organization's rule messages are sent from. Only messages sent through the platform's connection
 * count, and the organization is always the one of that message's own conversation. The first match wins:
 * <ol>
 *   <li>the message it answers ({@code context.id}, also sent with a quick-reply tap, or a button payload
 *       carrying our message id or wamid), sent to this phone; sets {@code inReplyTo} and the run;</li>
 *   <li>the newest message sent to this phone whose run still waits; sets the run;</li>
 *   <li>the newest message sent to this phone;</li>
 *   <li>else the platform keeps it, on its own conversation with the phone.</li>
 * </ol>
 */
final class PlatformInboundRouter {

    private static final Logger LOG = Logger.getLogger(PlatformInboundRouter.class);

    private final ConversationRepository conversations;
    private final MessageRepository messages;

    PlatformInboundRouter(ConversationRepository conversations, MessageRepository messages) {
        this.conversations = conversations;
        this.messages = messages;
    }

    InboundRoute route(InboundMessage message, OffsetDateTime now) {
        String address = message.fromE164();
        Message answered = answeredMessage(messages, message);
        if (answered != null && sentToViaPlatform(answered, address)) {
            Conversation conversation = conversations.findById(answered.conversationId());
            if (conversation != null && address.equals(conversation.participantAddress())) {
                return new InboundRoute(conversation.tenantCode(), conversation, answered.id(), answered.runId(),
                        answered.step());
            }
        }
        InboundRoute waiting = latest(address, true);
        if (waiting != null) {
            return waiting;
        }
        InboundRoute latest = latest(address, false);
        if (latest != null) {
            return latest;
        }
        LOG.infof("WhatsApp message %s on the platform number matches no organization; kept by the platform",
                message.wamid());
        return InboundRoute.to(WhatsAppInboundService.latestOpenOrNew(conversations, PLATFORM_TENANT, message, now));
    }

    private InboundRoute latest(String address, boolean waitingRun) {
        OutboundRef ref = messages.findLatestOutboundVia(address, PLATFORM_TENANT, waitingRun);
        Conversation conversation = ref == null ? null
                : conversations.findByTenantAndId(ref.tenantCode(), ref.conversationId());
        if (conversation == null) {
            return null;
        }
        return new InboundRoute(conversation.tenantCode(), conversation, null, waitingRun ? ref.runId() : null,
                null);
    }

    private static boolean sentToViaPlatform(Message answered, String address) {
        return answered.direction() == MessageDirection.OUTBOUND && answered.channel() == Channel.WHATSAPP
                && address.equals(answered.address()) && answered.metadata() != null
                && PLATFORM_TENANT.equals(answered.metadata().get(CONNECTION_TENANT));
    }

    /** The message an inbound one names as answered: {@code context.id}, else a button payload as id or wamid. */
    static Message answeredMessage(MessageRepository messages, InboundMessage message) {
        Message byContext = messages.findByProviderMessageId(Channel.WHATSAPP, message.contextMessageId());
        if (byContext != null) {
            return byContext;
        }
        String payload = message.buttonPayload();
        if (payload == null || payload.isBlank()) {
            return null;
        }
        Message byId = messages.findById(payload);
        if (byId != null) {
            return byId;
        }
        return messages.findByProviderMessageId(Channel.WHATSAPP, payload);
    }
}

package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.ConversationStatus;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import com.microboxlabs.miot.conversational.persistence.MessageRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** In-memory stand-ins for the two repositories, applying the same lookup rules as the SQL. */
final class InMemoryConversations {

    final Map<String, Conversation> conversations = new LinkedHashMap<>();
    final List<Message> messages = new ArrayList<>();
    final Conversations conversationRepository = new Conversations();
    final Messages messageRepository = new Messages();

    Conversation put(Conversation conversation) {
        conversations.put(conversation.id(), conversation);
        return conversation;
    }

    List<Conversation> forAddress(String address) {
        return conversations.values().stream().filter(c -> address.equals(c.participantAddress())).toList();
    }

    static Conversation conversation(
            String id, String tenantCode, String address, ContextKind kind, String key, OffsetDateTime lastMessageAt) {
        return new Conversation(id, tenantCode, address, null, null,
                kind == ContextKind.SERVICE ? key : null, null, null, ConversationStatus.OPEN,
                null, null, lastMessageAt, null, null, 0, lastMessageAt, lastMessageAt,
                kind, key, address, null, null, null, Map.of());
    }

    final class Conversations extends ConversationRepository {
        Conversations() {
            super(null);
        }

        @Override
        public Conversation findByContextAndAddress(
                String tenantCode, ContextKind kind, String contextKey, String address) {
            return conversations.values().stream()
                    .filter(c -> c.tenantCode().equals(tenantCode) && c.contextKind() == kind
                            && Objects.equals(c.contextKey(), contextKey)
                            && address.equals(c.participantAddress()))
                    .findFirst().orElse(null);
        }

        @Override
        public Conversation findOpenUnassignedByAddress(String tenantCode, String address) {
            return conversations.values().stream()
                    .filter(c -> c.tenantCode().equals(tenantCode) && c.contextKind() == null
                            && c.status() == ConversationStatus.OPEN && address.equals(c.participantAddress()))
                    .findFirst().orElse(null);
        }

        @Override
        public Conversation findLatestOpenByAddress(String tenantCode, String address) {
            return conversations.values().stream()
                    .filter(c -> c.tenantCode().equals(tenantCode) && c.status() == ConversationStatus.OPEN
                            && address.equals(c.participantAddress()))
                    .max(Comparator.comparing(Conversation::lastMessageAt,
                            Comparator.nullsFirst(Comparator.naturalOrder())))
                    .orElse(null);
        }

        @Override
        public Conversation findByTenantAndId(String tenantCode, String conversationId) {
            Conversation c = conversations.get(conversationId);
            return c != null && c.tenantCode().equals(tenantCode) ? c : null;
        }

        @Override
        public Conversation create(Conversation conversation) {
            return put(conversation);
        }

        @Override
        public Conversation updateOutbound(String conversationId, OutboundTouch t) {
            Conversation c = conversations.get(conversationId);
            boolean adopt = c.contextKind() == null;
            return put(new Conversation(c.id(), c.tenantCode(), c.phoneE164(), c.waContactName(),
                    t.driverId() != null ? t.driverId() : c.driverId(),
                    adopt ? t.contextServiceCode() : c.contextServiceCode(),
                    c.contextProcessInstanceId(), c.contextTaskId(), c.status(),
                    c.lastInboundAt(), t.occurredAt(), t.occurredAt(), c.sessionExpiresAt(), t.lastMessagePreview(),
                    c.unreadCount(), c.createdAt(), t.occurredAt(),
                    adopt ? t.contextKind() : c.contextKind(), adopt ? t.contextKey() : c.contextKey(),
                    c.participantAddress(), c.participantContactId(), c.participantRole(), c.displayName(),
                    c.channelState()));
        }

        @Override
        public Conversation updateInbound(
                String conversationId, OffsetDateTime occurredAt, String lastMessagePreview,
                OffsetDateTime sessionExpiresAt, String waContactName) {
            Conversation c = conversations.get(conversationId);
            return put(new Conversation(c.id(), c.tenantCode(), c.phoneE164(), waContactName, c.driverId(),
                    c.contextServiceCode(), c.contextProcessInstanceId(), c.contextTaskId(), c.status(),
                    occurredAt, c.lastOutboundAt(), occurredAt, sessionExpiresAt, lastMessagePreview,
                    c.unreadCount() + 1, c.createdAt(), occurredAt, c.contextKind(), c.contextKey(),
                    c.participantAddress(), c.participantContactId(), c.participantRole(), c.displayName(),
                    c.channelState()));
        }
    }

    final class Messages extends MessageRepository {
        Messages() {
            super(null);
        }

        @Override
        public Message append(Message message) {
            messages.add(message);
            return message;
        }

        @Override
        public Message appendInbound(Message message) {
            if (findByProviderMessageId(message.channel(), message.providerMessageId()) != null) {
                return null;
            }
            return append(message);
        }

        @Override
        public Message findByProviderMessageId(Channel channel, String providerMessageId) {
            if (providerMessageId == null) {
                return null;
            }
            return messages.stream()
                    .filter(m -> m.channel() == channel && providerMessageId.equals(m.providerMessageId()))
                    .findFirst().orElse(null);
        }

        @Override
        public Message findById(String messageId) {
            return messages.stream().filter(m -> m.id().equals(messageId)).findFirst().orElse(null);
        }

        @Override
        public Message markStatus(
                String messageId, MessageStatus status, OffsetDateTime deliveredAt,
                OffsetDateTime readAt, String errorMessage) {
            return null;
        }
    }
}

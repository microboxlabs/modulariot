package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.ConversationStatus;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import com.microboxlabs.miot.conversational.persistence.MessageRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** In-memory stand-ins for the two repositories, applying the same lookup rules as the SQL. */
public final class InMemoryConversations {

    public final Map<String, Conversation> conversations = new LinkedHashMap<>();
    public final List<Message> messages = new ArrayList<>();
    /** Ids of the runs {@code findWithWaitingRun} treats as WAITING. */
    public final Set<String> waitingRuns = new HashSet<>();
    /** Ids of the messages {@code markStatus} was called for, in order. */
    public final List<String> statusMarked = new ArrayList<>();
    public final Conversations conversationRepository = new Conversations();
    public final Messages messageRepository = new Messages();

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

    public final class Conversations extends ConversationRepository {
        public int outboundTouches;

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

        /** A run waits on the conversation of its newest outbound message to the address. */
        @Override
        public WithWaitingRun findWithWaitingRun(String tenantCode, String address) {
            for (int i = messages.size() - 1; i >= 0; i--) {
                Message m = messages.get(i);
                Conversation c = conversations.get(m.conversationId());
                if (m.runId() != null && waitingRuns.contains(m.runId()) && address.equals(m.address())
                        && m.direction() == MessageDirection.OUTBOUND && c != null
                        && m.status() != MessageStatus.SIMULATED && m.status() != MessageStatus.FAILED
                        && c.tenantCode().equals(tenantCode) && !WhatsAppMessagingService.PLATFORM_TENANT
                                .equals(m.metadata() == null ? null : m.metadata().get(
                                        WhatsAppMessagingService.CONNECTION_TENANT))) {
                    return new WithWaitingRun(c, m.runId());
                }
            }
            return null;
        }

        @Override
        public Conversation findByTenantAndId(String tenantCode, String conversationId) {
            Conversation c = conversations.get(conversationId);
            return c != null && c.tenantCode().equals(tenantCode) ? c : null;
        }

        @Override
        public Conversation findById(String conversationId) {
            return conversations.get(conversationId);
        }

        @Override
        public Conversation create(Conversation conversation) {
            return put(conversation);
        }

        @Override
        public Conversation updateOutbound(String conversationId, OutboundTouch t) {
            outboundTouches += 1;
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
    }

    public final class Messages extends MessageRepository {
        public boolean hideNextProviderLookup;

        Messages() {
            super(null);
        }

        @Override
        public Message append(Message message) {
            messages.add(message);
            return message;
        }

        @Override
        public Message appendOutbound(Message message, ConversationRepository.OutboundTouch touch) {
            if (findByProviderMessageId(message.channel(), message.providerMessageId()) != null) {
                return null;
            }
            Message stored = append(message);
            conversationRepository.updateOutbound(message.conversationId(), touch);
            return stored;
        }

        /** Set to make the next {@code appendInbound} fail before writing anything, as a rolled-back statement. */
        RuntimeException failNextInbound;

        @Override
        public Message appendInbound(Message message, ConversationRepository.InboundTouch t) {
            if (failNextInbound != null) {
                RuntimeException failure = failNextInbound;
                failNextInbound = null;
                throw failure;
            }
            if (findByProviderMessageId(message.channel(), message.providerMessageId()) != null) {
                return null;
            }
            Conversation c = conversations.get(message.conversationId());
            put(new Conversation(c.id(), c.tenantCode(), c.phoneE164(), t.contactName(), c.driverId(),
                    c.contextServiceCode(), c.contextProcessInstanceId(), c.contextTaskId(), c.status(),
                    t.occurredAt(), c.lastOutboundAt(), t.occurredAt(), t.sessionExpiresAt(), t.lastMessagePreview(),
                    c.unreadCount() + 1, c.createdAt(), t.occurredAt(), c.contextKind(), c.contextKey(),
                    c.participantAddress(), c.participantContactId(), c.participantRole(), c.displayName(),
                    c.channelState()));
            return append(message);
        }

        @Override
        public Message findByProviderMessageId(Channel channel, String providerMessageId) {
            if (hideNextProviderLookup) {
                hideNextProviderLookup = false;
                return null;
            }
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
        public Message appendQueued(Message message) {
            Message existing = findById(message.id());
            return existing == null ? append(message) : existing;
        }

        @Override
        public Message markStatus(
                String messageId, MessageStatus status, OffsetDateTime deliveredAt,
                OffsetDateTime readAt, String errorMessage, Set<MessageStatus> from) {
            statusMarked.add(messageId);
            for (int i = 0; i < messages.size(); i++) {
                Message m = messages.get(i);
                if (m.id().equals(messageId) && (m.status() == MessageStatus.PENDING
                        || m.status() == MessageStatus.FAILED) && status == MessageStatus.FAILED
                        && from.contains(MessageStatus.PENDING)) {
                    Message failed = new Message(m.id(), m.conversationId(), m.direction(), m.role(), m.type(),
                            m.body(), m.templateName(), m.mediaRef(), m.mediaMimeType(), m.mediaFileName(),
                            m.providerMessageId(), MessageStatus.FAILED, errorMessage, m.sentByUserId(),
                            m.serviceCode(), m.processInstanceId(), m.metadata(), m.sentAt(), m.deliveredAt(),
                            m.readAt(), m.createdAt(), m.channel(), m.address(), m.inReplyTo(), m.runId(), m.step());
                    messages.set(i, failed);
                    return failed;
                }
            }
            return null;
        }

        @Override
        public Message markSent(String messageId, String providerMessageId, Map<String, Object> metadata,
                OffsetDateTime sentAt) {
            for (int i = 0; i < messages.size(); i++) {
                Message m = messages.get(i);
                if (m.id().equals(messageId)
                        && (m.status() == MessageStatus.PENDING || m.status() == MessageStatus.FAILED)) {
                    Map<String, Object> merged = new LinkedHashMap<>(m.metadata() == null ? Map.of() : m.metadata());
                    merged.putAll(metadata);
                    Message sent = new Message(m.id(), m.conversationId(), m.direction(), m.role(), m.type(),
                            m.body(), m.templateName(), m.mediaRef(), m.mediaMimeType(), m.mediaFileName(),
                            providerMessageId, MessageStatus.SENT, null, m.sentByUserId(), m.serviceCode(),
                            m.processInstanceId(), merged, sentAt, m.deliveredAt(), m.readAt(), m.createdAt(),
                            m.channel(), m.address(), m.inReplyTo(), m.runId(), m.step());
                    messages.set(i, sent);
                    return sent;
                }
            }
            return null;
        }

        /** The newest stored message wins, as {@code created_at DESC} on the SQL side. */
        @Override
        public String findLatestConnectionTenant(String conversationId) {
            for (int i = messages.size() - 1; i >= 0; i--) {
                Message m = messages.get(i);
                if (!m.conversationId().equals(conversationId) || m.channel() != Channel.WHATSAPP
                        || m.metadata() == null || m.status() == MessageStatus.SIMULATED
                        || m.status() == MessageStatus.FAILED) {
                    continue;
                }
                Object tenant = m.metadata().get("connectionTenant");
                if (tenant != null) {
                    return String.valueOf(tenant);
                }
                if (m.direction() == MessageDirection.OUTBOUND && m.metadata().get("connectionId") != null) {
                    return null;
                }
            }
            return null;
        }

        @Override
        public OutboundRef findLatestOutboundVia(String address, String connectionTenant, boolean waitingRun) {
            for (int i = messages.size() - 1; i >= 0; i--) {
                Message m = messages.get(i);
                Conversation c = conversations.get(m.conversationId());
                if (c != null && m.channel() == Channel.WHATSAPP && m.direction() == MessageDirection.OUTBOUND
                        && address.equals(m.address())
                        && connectionTenant.equals(m.metadata().get("connectionTenant"))
                        && m.status() != MessageStatus.SIMULATED && m.status() != MessageStatus.FAILED
                        && (!waitingRun || (m.runId() != null && waitingRuns.contains(m.runId())))) {
                    return new OutboundRef(m.id(), c.id(), c.tenantCode(), m.runId(), m.step());
                }
            }
            return null;
        }
    }
}

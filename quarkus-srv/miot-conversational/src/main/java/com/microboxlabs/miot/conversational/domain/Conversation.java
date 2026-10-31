package com.microboxlabs.miot.conversational.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * One conversation per context and participant. {@code contextKind} / {@code contextKey} say what
 * it is about (for example a service code), both null for a conversation without context.
 * {@code participantAddress} is the other side's phone (E.164) or email. Two people messaged
 * about one service have two conversations.
 *
 * <p>{@code contextServiceCode} repeats {@code contextKey} for service conversations, and
 * {@code phoneE164} / {@code waContactName} stay for WhatsApp readers. The WhatsApp 24 h window
 * is {@code sessionExpiresAt}; {@code channelState} holds state of other channels.
 */
public record Conversation(
        String id,
        String tenantCode,
        String phoneE164,
        String waContactName,
        String driverId,
        String contextServiceCode,
        String contextProcessInstanceId,
        String contextTaskId,
        ConversationStatus status,
        OffsetDateTime lastInboundAt,
        OffsetDateTime lastOutboundAt,
        OffsetDateTime lastMessageAt,
        OffsetDateTime sessionExpiresAt,
        String lastMessagePreview,
        int unreadCount,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        ContextKind contextKind,
        String contextKey,
        String participantAddress,
        String participantContactId,
        String participantRole,
        String displayName,
        Map<String, Object> channelState) {

    public static final String ROLE_DRIVER = "driver";
}

package com.microboxlabs.miot.conversational.domain;

import java.time.OffsetDateTime;

/**
 * One WhatsApp conversation per SERVICE (a "service thread") — a driver runs one service at a time
 * (presentDriver → confirmArrival → delivery tail), so {@code contextServiceCode} is the thread's
 * immutable identity, not a moving pointer. A phone hosts many service threads over time; inbound
 * replies attach to the newest thread for that phone. A thread with a null service is "unassigned"
 * (cold inbound before a service claims the number) and is adopted by the next trip-tied send.
 * Carries 24h-window state so the interaction history per service is recoverable.
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
        OffsetDateTime updatedAt) {
}

package com.microboxlabs.miot.conversational.domain;

import java.time.OffsetDateTime;

/**
 * One WhatsApp conversation per (tenant, phone). Holds the current trip context the
 * conversation is about (anchored on outbound trip-tied sends) plus 24h-window state,
 * so the whole interaction history per number / per driver is recoverable.
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

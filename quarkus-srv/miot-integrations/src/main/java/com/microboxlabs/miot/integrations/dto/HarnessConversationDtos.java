package com.microboxlabs.miot.integrations.dto;

import com.fasterxml.jackson.databind.JsonNode;

/** The harness's conversation memory, as {@code /internal/harness-conversations} moves it. */
public final class HarnessConversationDtos {

    private HarnessConversationDtos() {
    }

    /**
     * One conversation's memory. {@code key} is the harness's key for it (tenant,
     * user and conversation); {@code memory} is the harness's own document, stored
     * as it arrives.
     */
    public record ConversationMemory(
            String key,
            String tenantId,
            String userId,
            String conversationId,
            String model,
            JsonNode memory) {
    }
}

package com.microboxlabs.miot.integrations.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.dto.HarnessConversationDtos.ConversationMemory;
import com.microboxlabs.miot.integrations.persistence.HarnessConversationRepository;
import com.microboxlabs.miot.integrations.persistence.HarnessConversationRepository.StoredConversation;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Optional;

/**
 * Saves and loads the harness's memory of a conversation.
 *
 * <p>Validation throws {@link IllegalArgumentException}, which the resource maps to 400.
 */
@ApplicationScoped
public class HarnessConversationService {

    static final int MAX_KEY_LENGTH = 1_000;
    static final int MAX_ID_LENGTH = 500;
    /** A conversation holds at most a few dozen turns with capped tool results. */
    static final int MAX_MEMORY_CHARS = 8_000_000;

    private final HarnessConversationRepository repository;
    private final ObjectMapper mapper;

    @Inject
    public HarnessConversationService(HarnessConversationRepository repository, ObjectMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    /** The memory saved for {@code key}, only when it belongs to {@code tenantId}. */
    public Optional<ConversationMemory> load(String key, String tenantId) {
        String k = required(key, "key", MAX_KEY_LENGTH);
        String tenant = required(tenantId, "tenantId", MAX_ID_LENGTH);
        return repository.find(k, tenant).map(this::toMemory);
    }

    /** Returns false when the key already belongs to another tenant. */
    public boolean save(ConversationMemory body) {
        if (body == null) {
            throw new IllegalArgumentException("body is required");
        }
        if (body.memory() == null || !body.memory().isObject()) {
            throw new IllegalArgumentException("memory must be a JSON object");
        }
        String memory;
        try {
            memory = mapper.writeValueAsString(body.memory());
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("memory is not serializable", e);
        }
        if (memory.length() > MAX_MEMORY_CHARS) {
            throw new IllegalArgumentException("memory exceeds " + MAX_MEMORY_CHARS + " characters");
        }
        return repository.upsert(new StoredConversation(
                required(body.key(), "key", MAX_KEY_LENGTH),
                required(body.tenantId(), "tenantId", MAX_ID_LENGTH),
                optional(body.userId(), "userId", MAX_ID_LENGTH),
                required(body.conversationId(), "conversationId", MAX_ID_LENGTH),
                optional(body.model(), "model", MAX_ID_LENGTH),
                memory,
                null));
    }

    private ConversationMemory toMemory(StoredConversation stored) {
        try {
            return new ConversationMemory(
                    stored.key(),
                    stored.tenantId(),
                    stored.userId(),
                    stored.conversationId(),
                    stored.model(),
                    mapper.readTree(stored.memory()));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("stored memory is not JSON for " + stored.key(), e);
        }
    }

    private static String required(String value, String name, int max) {
        String v = optional(value, name, max);
        if (v == null) {
            throw new IllegalArgumentException(name + " is required");
        }
        return v;
    }

    private static String optional(String value, String name, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.length() > max) {
            throw new IllegalArgumentException(name + " exceeds " + max + " characters");
        }
        return value;
    }
}

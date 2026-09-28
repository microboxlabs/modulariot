package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.dto.HarnessConversationDtos.ConversationMemory;
import com.microboxlabs.miot.integrations.persistence.HarnessConversationRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class HarnessConversationServiceTest {

    private static final String KEY = "[\"acme\", \"ana@acme.test\", \"conv-1\"]";

    private final ObjectMapper mapper = new ObjectMapper();
    private final FakeRepository repository = new FakeRepository();
    private final HarnessConversationService service = new HarnessConversationService(repository, mapper);

    private JsonNode memory(String summary) throws Exception {
        return mapper.readTree("{\"summary\": \"" + summary + "\", \"turns\": [{\"user_message\": \"q\"}]}");
    }

    private ConversationMemory body(String tenant, JsonNode memory) {
        return new ConversationMemory(KEY, tenant, "ana@acme.test", "conv-1", "llmgateway:deepseek-v4-flash", memory);
    }

    @Test
    void savedMemoryLoadsBackWithItsModel() throws Exception {
        assertTrue(service.save(body("acme", memory("trips so far"))));

        ConversationMemory loaded = service.load(KEY, "acme").orElseThrow();
        assertEquals("llmgateway:deepseek-v4-flash", loaded.model());
        assertEquals("trips so far", loaded.memory().get("summary").asText());
        assertEquals("q", loaded.memory().get("turns").get(0).get("user_message").asText());
    }

    @Test
    void anUnknownConversationHasNoMemory() {
        assertTrue(service.load("[\"acme\", \"ana\", \"nope\"]", "acme").isEmpty());
    }

    @Test
    void anotherTenantCannotReplaceTheRow() throws Exception {
        assertTrue(service.save(body("acme", memory("mine"))));
        assertFalse(service.save(body("globex", memory("theirs"))));
        assertEquals("mine", service.load(KEY, "acme").orElseThrow().memory().get("summary").asText());
        assertTrue(service.load(KEY, "globex").isEmpty(), "another tenant cannot read it either");
    }

    @Test
    void whatCannotBeStoredIsRefused() throws Exception {
        JsonNode array = mapper.readTree("[1, 2]");
        JsonNode ok = memory("x");
        ConversationMemory noMemory = body("acme", null);
        ConversationMemory notAnObject = body("acme", array);
        ConversationMemory noTenant = body(" ", ok);
        ConversationMemory noConversation = new ConversationMemory(KEY, "acme", null, null, null, ok);
        assertThrows(IllegalArgumentException.class, () -> service.save(null));
        assertThrows(IllegalArgumentException.class, () -> service.save(noMemory), "no memory");
        assertThrows(IllegalArgumentException.class, () -> service.save(notAnObject), "not an object");
        assertThrows(IllegalArgumentException.class, () -> service.save(noTenant), "no tenant");
        assertThrows(IllegalArgumentException.class, () -> service.save(noConversation), "no conversation id");
        assertThrows(IllegalArgumentException.class, () -> service.load(null, "acme"), "no key");
        assertThrows(IllegalArgumentException.class, () -> service.load(KEY, null), "no tenant to load");
        assertTrue(repository.rows.isEmpty());
    }

    @Test
    void anOversizedMemoryIsRefused() throws Exception {
        String big = "x".repeat(HarnessConversationService.MAX_MEMORY_CHARS);
        ConversationMemory oversized = body("acme", mapper.readTree("{\"summary\": \"" + big + "\"}"));
        assertThrows(IllegalArgumentException.class, () -> service.save(oversized));
    }

    /** Keeps rows in a map and applies the SQL's tenant guard. */
    static final class FakeRepository extends HarnessConversationRepository {
        final Map<String, StoredConversation> rows = new HashMap<>();

        FakeRepository() {
            super(null);
        }

        @Override
        public Optional<StoredConversation> find(String key, String tenantId) {
            return Optional.ofNullable(rows.get(key)).filter(c -> c.tenantId().equals(tenantId));
        }

        @Override
        public boolean upsert(StoredConversation c) {
            StoredConversation existing = rows.get(c.key());
            if (existing != null && !existing.tenantId().equals(c.tenantId())) {
                return false;
            }
            rows.put(c.key(), c);
            return true;
        }
    }
}

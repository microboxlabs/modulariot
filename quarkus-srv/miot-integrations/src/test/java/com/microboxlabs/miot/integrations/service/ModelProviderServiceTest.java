package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.domain.ModelProvider;
import com.microboxlabs.miot.integrations.dto.ModelProviderDtos.HarnessModelProvider;
import com.microboxlabs.miot.integrations.dto.ModelProviderDtos.ModelEntry;
import com.microboxlabs.miot.integrations.dto.ModelProviderDtos.ModelProviderResponse;
import com.microboxlabs.miot.integrations.dto.ModelProviderDtos.SetModelProviderRequest;
import com.microboxlabs.miot.integrations.persistence.ModelProviderRepository;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;

class ModelProviderServiceTest {

    private static final String OWNER = "owner@example.test";

    /** Rows kept in a map, as the table keeps them by provider. */
    static final class FakeRepository extends ModelProviderRepository {
        final Map<String, ModelProvider> rows = new TreeMap<>();

        FakeRepository() {
            super(null);
        }

        @Override
        public List<ModelProvider> list() {
            return new ArrayList<>(rows.values());
        }

        @Override
        public ModelProvider find(String provider) {
            return rows.get(provider);
        }

        @Override
        public ModelProvider upsert(ModelProvider p) {
            rows.put(p.provider(), p);
            return p;
        }

        @Override
        public boolean delete(String provider) {
            return rows.remove(provider) != null;
        }
    }

    private final FakeRepository repository = new FakeRepository();
    private final IntegrationSecretCipher cipher = new IntegrationSecretCipher(new ObjectMapper(), "unit-test-key");
    private final ModelProviderService service = new ModelProviderService(repository, cipher);

    private static ModelEntry model(String id, boolean isDefault) {
        return new ModelEntry(id, new BigDecimal("0.27"), new BigDecimal("1.10"), isDefault);
    }

    private ModelProviderResponse put(String provider, String key, ModelEntry... models) {
        return service.put(provider, new SetModelProviderRequest(key, null, List.of(models), null), OWNER);
    }

    @Test
    void theKeyIsStoredEncryptedAndOnlyItsEndIsShown() {
        ModelProviderResponse saved = put("deepseek", "sk-deepseek-1234", model("deepseek-chat", false));

        assertEquals("…1234", saved.keyPreview());
        String stored = repository.rows.get("deepseek").encryptedKey();
        assertFalse(stored.contains("sk-deepseek"), "the key is never stored in clear");
        assertEquals(OWNER, saved.updatedBy());
    }

    @Test
    void theHarnessGetsTheKeyBackForEnabledProvidersOnly() {
        put("deepseek", "sk-deepseek-1234", model("deepseek-chat", false));
        service.put("kimi", new SetModelProviderRequest("sk-kimi-9999", null, List.of(), false), OWNER);

        List<HarnessModelProvider> providers = service.forHarness();

        assertEquals(1, providers.size());
        assertEquals("sk-deepseek-1234", providers.get(0).apiKey());
        assertEquals("deepseek-chat", providers.get(0).models().get(0).id());
        assertEquals(new BigDecimal("0.27"), providers.get(0).models().get(0).inputPerMtok());
    }

    @Test
    void aBlankKeyKeepsTheStoredOne() {
        put("openai", "sk-openai-aaaa", model("gpt-4o", false));
        String before = repository.rows.get("openai").encryptedKey();

        ModelProviderResponse saved = put("openai", "  ", model("gpt-4o", false), model("gpt-4o-mini", false));

        assertEquals(before, repository.rows.get("openai").encryptedKey());
        assertEquals("…aaaa", saved.keyPreview());
        assertEquals(2, saved.models().size());
    }

    @Test
    void aNewKeyReplacesTheStoredOne() {
        put("openai", "sk-openai-aaaa");
        String before = repository.rows.get("openai").encryptedKey();

        put("openai", "sk-openai-bbbb");

        assertNotEquals(before, repository.rows.get("openai").encryptedKey());
        assertEquals("sk-openai-bbbb", service.forHarness().get(0).apiKey());
    }

    @Test
    void oneModelIsTheDefaultAcrossEveryProvider() {
        put("anthropic", "sk-ant-1111", model("claude-sonnet-4-6", true));

        put("deepseek", "sk-ds-2222", model("deepseek-chat", true));

        assertFalse(repository.rows.get("anthropic").models().get(0).isDefault(),
                "the earlier default was cleared");
        assertTrue(repository.rows.get("deepseek").models().get(0).isDefault());
    }

    @Test
    void whatCannotBeStoredIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> put("acme-ai", "k"), "unknown provider");
        assertThrows(IllegalArgumentException.class, () -> put("qwen", ""), "a new provider needs a key");
        assertThrows(IllegalArgumentException.class,
                () -> put("qwen", "k", model("qwen-max", false), model("qwen-max", false)), "duplicate model");
        assertThrows(IllegalArgumentException.class,
                () -> put("qwen", "k", model("a", true), model("b", true)), "two defaults");
        assertThrows(IllegalArgumentException.class,
                () -> put("qwen", "k", new ModelEntry("a", new BigDecimal("-1"), null, false)), "negative price");
        assertThrows(IllegalArgumentException.class,
                () -> service.put("qwen", new SetModelProviderRequest("k", "http://x.test", List.of(), true), OWNER),
                "plain http");
        assertTrue(repository.rows.isEmpty());
    }

    @Test
    void deletingRemovesTheProviderAndItsKey() {
        put("glm", "sk-glm-3333");

        assertTrue(service.delete("glm"));
        assertFalse(service.delete("glm"));
        assertTrue(service.forHarness().isEmpty());
    }
}

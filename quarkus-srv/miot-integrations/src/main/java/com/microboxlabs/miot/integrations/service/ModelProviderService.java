package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.ModelProvider;
import com.microboxlabs.miot.integrations.dto.ModelProviderDtos.HarnessModelProvider;
import com.microboxlabs.miot.integrations.dto.ModelProviderDtos.ModelEntry;
import com.microboxlabs.miot.integrations.dto.ModelProviderDtos.ModelProviderResponse;
import com.microboxlabs.miot.integrations.dto.ModelProviderDtos.SetModelProviderRequest;
import com.microboxlabs.miot.integrations.persistence.ModelProviderRepository;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The AI model providers the harness may call, set by the platform owner.
 * Keys are stored encrypted and only ever decrypted for the harness.
 *
 * <p>Validation throws {@link IllegalArgumentException}, which the resource maps to 400.
 */
@ApplicationScoped
public class ModelProviderService {

    /** The providers the harness knows how to call; keep in step with its model_providers.py. */
    public static final Set<String> KNOWN = Set.of(
            "anthropic", "openai", "openrouter", "deepseek", "qwen", "kimi", "glm");

    private static final String KEY_FIELD = "apiKey";

    private final ModelProviderRepository repository;
    private final IntegrationSecretCipher cipher;

    @Inject
    public ModelProviderService(ModelProviderRepository repository, IntegrationSecretCipher cipher) {
        this.repository = repository;
        this.cipher = cipher;
    }

    public List<ModelProviderResponse> list() {
        return repository.list().stream().map(ModelProviderService::toResponse).toList();
    }

    public ModelProviderResponse put(String provider, SetModelProviderRequest req, String actor) {
        if (!KNOWN.contains(provider)) {
            throw new IllegalArgumentException("unknown provider: " + provider + "; known: " + sortedKnown());
        }
        if (req == null) {
            throw new IllegalArgumentException("body is required");
        }
        ModelProvider existing = repository.find(provider);
        String apiKey = req.apiKey() == null ? "" : req.apiKey().strip();
        if (apiKey.isEmpty() && existing == null) {
            throw new IllegalArgumentException("apiKey is required for a new provider");
        }
        List<ModelProvider.Model> models = models(req.models());

        String encrypted = apiKey.isEmpty() ? existing.encryptedKey() : cipher.encrypt(Map.of(KEY_FIELD, apiKey));
        String preview = apiKey.isEmpty() ? existing.keyPreview() : preview(apiKey);
        ModelProvider saved = repository.upsert(new ModelProvider(
                provider,
                baseUrl(req.baseUrl()),
                encrypted,
                preview,
                models,
                req.enabled() == null || req.enabled(),
                actor,
                null));
        if (models.stream().anyMatch(ModelProvider.Model::isDefault)) {
            clearDefaultsExcept(provider);
        }
        return toResponse(saved);
    }

    public boolean delete(String provider) {
        return repository.delete(provider);
    }

    /** Every enabled provider with its key decrypted, for the harness. */
    public List<HarnessModelProvider> forHarness() {
        List<HarnessModelProvider> out = new ArrayList<>();
        for (ModelProvider p : repository.list()) {
            if (!p.enabled()) {
                continue;
            }
            Object key = cipher.decrypt(p.encryptedKey()).get(KEY_FIELD);
            out.add(new HarnessModelProvider(p.provider(), p.baseUrl(), String.valueOf(key), entries(p.models())));
        }
        return out;
    }

    private void clearDefaultsExcept(String provider) {
        for (ModelProvider other : repository.list()) {
            if (other.provider().equals(provider)
                    || other.models().stream().noneMatch(ModelProvider.Model::isDefault)) {
                continue;
            }
            repository.upsert(other.withModels(other.models().stream()
                    .map(m -> new ModelProvider.Model(m.id(), m.inputPerMtok(), m.outputPerMtok(), false))
                    .toList()));
        }
    }

    private static List<ModelProvider.Model> models(List<ModelEntry> entries) {
        List<ModelProvider.Model> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int defaults = 0;
        for (ModelEntry e : entries == null ? List.<ModelEntry>of() : entries) {
            String id = e == null || e.id() == null ? "" : e.id().strip();
            if (id.isEmpty()) {
                throw new IllegalArgumentException("every model needs an id");
            }
            if (!seen.add(id)) {
                throw new IllegalArgumentException("model listed twice: " + id);
            }
            price(e.inputPerMtok(), id);
            price(e.outputPerMtok(), id);
            boolean isDefault = Boolean.TRUE.equals(e.isDefault());
            if (isDefault) {
                defaults++;
            }
            out.add(new ModelProvider.Model(id, e.inputPerMtok(), e.outputPerMtok(), isDefault));
        }
        if (defaults > 1) {
            throw new IllegalArgumentException("only one model can be the default");
        }
        return out;
    }

    private static void price(BigDecimal value, String model) {
        if (value != null && value.signum() < 0) {
            throw new IllegalArgumentException("price of " + model + " cannot be negative");
        }
    }

    private static String baseUrl(String value) {
        String url = value == null ? "" : value.strip();
        if (url.isEmpty()) {
            return null;
        }
        if (!url.startsWith("https://")) {
            throw new IllegalArgumentException("baseUrl must be an https URL");
        }
        return url;
    }

    static String preview(String apiKey) {
        return apiKey.length() <= 4 ? "…" : "…" + apiKey.substring(apiKey.length() - 4);
    }

    private static List<String> sortedKnown() {
        return KNOWN.stream().sorted().toList();
    }

    private static List<ModelEntry> entries(List<ModelProvider.Model> models) {
        return models.stream()
                .map(m -> new ModelEntry(m.id(), m.inputPerMtok(), m.outputPerMtok(), m.isDefault()))
                .toList();
    }

    private static ModelProviderResponse toResponse(ModelProvider p) {
        return new ModelProviderResponse(
                p.provider(), p.baseUrl(), p.keyPreview(), entries(p.models()), p.enabled(),
                p.updatedBy(), p.updatedAt());
    }
}

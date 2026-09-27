package com.microboxlabs.miot.core.harness;

import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Test gate, enabled only by {@link HarnessPlanGateTestProfile}: refuses runs
 * that name {@link #BLOCKED}, runs {@link #KEPT} when none is named, and keeps
 * only {@link #KEPT} in the model list.
 */
@Alternative
@ApplicationScoped
public class RefusingHarnessPlanGate implements HarnessPlanGate {

    public static final String BLOCKED = "blocked-model";
    public static final String KEPT = "claude-opus-4-8";

    @Override
    public Uni<String> defaultModel(String organization) {
        return Uni.createFrom().item(KEPT);
    }

    @Override
    public Uni<Refusal> checkRun(String organization, String userEmail, String model) {
        return Uni.createFrom().item(BLOCKED.equals(model)
                ? new Refusal(402, "plan_pool_exhausted", "the organization used its tokens for this month")
                : null);
    }

    @Override
    public Uni<Map<String, Object>> models(String organization, Map<String, Object> models) {
        Map<String, Object> out = new LinkedHashMap<>(models);
        out.put("models", List.of(KEPT));
        out.put("multipliers", Map.of(KEPT, 3));
        return Uni.createFrom().item(out);
    }

    @Override
    public boolean changesModels() {
        return true;
    }
}

package com.microboxlabs.miot.core.harness;

import io.quarkus.arc.DefaultBean;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Map;

/** Used when no seat plan is deployed: every run may start, models are unchanged. */
@DefaultBean
@ApplicationScoped
public class AllowAllHarnessPlanGate implements HarnessPlanGate {

    @Override
    public Uni<Refusal> checkRun(String organization, String userEmail, String model) {
        return Uni.createFrom().nullItem();
    }

    @Override
    public Uni<Map<String, Object>> models(String organization, Map<String, Object> models) {
        return Uni.createFrom().item(models);
    }

    @Override
    public boolean changesModels() {
        return false;
    }
}

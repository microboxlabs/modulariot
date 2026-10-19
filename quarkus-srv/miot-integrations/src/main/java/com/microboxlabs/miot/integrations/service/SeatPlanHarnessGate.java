package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.core.harness.HarnessPlanGate;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.function.Supplier;

/** Applies the seat plan to harness runs. The service blocks, so it runs on a worker thread. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class SeatPlanHarnessGate implements HarnessPlanGate {

    private final HarnessPlanService service;

    @Inject
    public SeatPlanHarnessGate(HarnessPlanService service) {
        this.service = service;
    }

    @Override
    public Uni<String> defaultModel(String organization) {
        return onWorker(service::defaultModel);
    }

    @Override
    public Uni<Refusal> checkRun(String organization, String userEmail, String model) {
        return onWorker(() -> service.checkRun(organization, userEmail, model));
    }

    @Override
    public Uni<Map<String, Object>> models(String organization, Map<String, Object> models) {
        return onWorker(() -> service.models(models));
    }

    @Override
    public boolean changesModels() {
        return true;
    }

    private static <T> Uni<T> onWorker(Supplier<T> work) {
        return Uni.createFrom().item(work).runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }
}

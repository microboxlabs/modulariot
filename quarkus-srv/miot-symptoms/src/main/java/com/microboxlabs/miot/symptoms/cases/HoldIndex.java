package com.microboxlabs.miot.symptoms.cases;

import com.microboxlabs.miot.symptoms.evaluator.Holds;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.UUID;

/** Reads committed holds on every evaluation, including changes from another pod. A failed read retries the signal. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class HoldIndex implements Holds {

    private final HoldStore store;

    @Inject
    public HoldIndex(HoldStore store) {
        this.store = store;
    }

    @Override
    public boolean held(String tenantCode, String assetId, UUID definitionId, Instant caseOpenedAt) {
        // Expiry releases the hold only after the timer records the return and its new SLA start.
        return store.open(tenantCode).stream()
                .anyMatch(h -> h.covers(assetId, definitionId, caseOpenedAt));
    }

    /** Changes are visible directly from the store; retained for the treatment lifecycle's notification hook. */
    public void changed(String tenantCode) {
        // No local cache to invalidate.
    }
}

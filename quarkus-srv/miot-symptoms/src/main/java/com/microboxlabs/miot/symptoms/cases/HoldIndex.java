package com.microboxlabs.miot.symptoms.cases;

import com.microboxlabs.miot.symptoms.evaluator.Holds;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Reads committed holds on every evaluation, including changes from another pod; a signal reads each
 * organization's holds once ({@link #forSignal}). A failed read retries the signal.
 */
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
        return covered(store.open(tenantCode), assetId, definitionId, caseOpenedAt);
    }

    /** The organization's open holds read on the first question and kept for the rest of the signal. */
    @Override
    public Holds forSignal() {
        Map<String, List<IgnoreHold>> read = new HashMap<>();
        return (tenantCode, assetId, definitionId, caseOpenedAt) -> covered(
                read.computeIfAbsent(tenantCode, store::open), assetId, definitionId, caseOpenedAt);
    }

    private static boolean covered(List<IgnoreHold> open, String assetId, UUID definitionId, Instant caseOpenedAt) {
        // Expiry releases the hold only after the timer records the return and its new SLA start.
        return open.stream().anyMatch(h -> h.covers(assetId, definitionId, caseOpenedAt));
    }

    /** Changes are visible directly from the store; retained for the treatment lifecycle's notification hook. */
    public void changed(String tenantCode) {
        // No local cache to invalidate.
    }
}

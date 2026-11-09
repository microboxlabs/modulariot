package com.microboxlabs.miot.symptoms.cases;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.evaluator.Holds;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HoldIndexTest {

    private static final UUID SPEEDING = UUID.randomUUID();
    private static final UUID PANIC = UUID.randomUUID();
    private static final Instant AT = Instant.parse("2026-11-07T12:00:00Z");

    private final Map<String, List<IgnoreHold>> open = new HashMap<>();
    private final Map<String, Integer> reads = new HashMap<>();
    private final HoldStore store = new HoldStore() {
        @Override
        public List<IgnoreHold> open(String tenantCode) {
            reads.merge(tenantCode, 1, Integer::sum);
            return open.getOrDefault(tenantCode, List.of());
        }

        @Override
        public List<IgnoreHold> open(int limit) {
            return List.of();
        }

        @Override
        public Optional<IgnoreHold> find(String tenantCode, String treatmentId) {
            return Optional.empty();
        }

        @Override
        public Optional<Boolean> tripLive(String tenantCode, String tripId, String assetId) {
            return Optional.empty();
        }
    };

    private static IgnoreHold hold(String tenant, UUID definition, IgnoreHold.Scope scope) {
        return new IgnoreHold("t-1", tenant, 7, "TRUCK1", definition, null, scope, AT, "ops@example.com", 3600,
                false, false);
    }

    @Test
    void aSignalReadsEachOrganizationsHoldsOnceAndAnswersAsEveryRead() {
        open.put("org-a", List.of(hold("org-a", SPEEDING, IgnoreHold.Scope.SYMPTOM)));
        HoldIndex index = new HoldIndex(store);
        Holds signal = index.forSignal();

        assertTrue(signal.held("org-a", "TRUCK1", SPEEDING, null));
        assertFalse(signal.held("org-a", "TRUCK1", PANIC, null));
        assertFalse(signal.held("org-a", "TRUCK2", SPEEDING, null));
        assertFalse(signal.held("org-b", "TRUCK1", SPEEDING, null));
        assertFalse(signal.held("org-b", "TRUCK1", PANIC, null));

        assertEquals(Map.of("org-a", 1, "org-b", 1), reads);
        for (UUID d : List.of(SPEEDING, PANIC)) {
            assertEquals(index.held("org-a", "TRUCK1", d, AT.minusSeconds(60)),
                    signal.held("org-a", "TRUCK1", d, AT.minusSeconds(60)));
        }
    }

    @Test
    void theNextSignalSeesAHoldTakenSinceTheLastOne() {
        HoldIndex index = new HoldIndex(store);
        assertFalse(index.forSignal().held("org-a", "TRUCK1", SPEEDING, null));

        open.put("org-a", List.of(hold("org-a", SPEEDING, IgnoreHold.Scope.ALL)));

        assertTrue(index.forSignal().held("org-a", "TRUCK1", PANIC, null));
    }
}

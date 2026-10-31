package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.MonitorScope;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import com.microboxlabs.miot.trips.dto.MonitorRequest;
import com.microboxlabs.miot.trips.store.InMemoryTripsWorld;
import com.microboxlabs.miot.trips.store.MonitorStore;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class MonitorServiceTest {
    private boolean transaction;
    private boolean locked;
    private final MonitorStore store = new TestMonitors();
    private final Transactions tx = new Transactions() {
        public <T> T inTransaction(Supplier<T> work) {
            transaction = true;
            try { return work.get(); }
            finally { transaction = false; locked = false; }
        }
    };
    private final MonitorService service = new MonitorService(store, null, null,
            new AuditService(new InMemoryTripsWorld().auditStore), tx);

    @Test
    void normalizedPlanMatchesStageActionsAndPublishes() {
        MonitorRequest request = new MonitorRequest("Test monitor", null,
                List.of(new TripMonitor.StagePlan(" transit ", " READY ")), Map.of(),
                List.of(new MonitorRequest.Rule("advance", null, "plan", null, null,
                        List.of(new TripMonitor.Action("advance", "transit")), null, null)), MonitorScope.ANY);
        var saved = service.saveDraft("test", "test", "test-monitor", request);
        assertEquals("transit", saved.plan().get(0).stageType());
        assertEquals("READY", saved.plan().get(0).serviceStatus());
        assertTrue(saved.findings().isEmpty());
        service.publish("test", "test", "test-monitor");
    }

    @Test
    void missingActionTypeIsAValidationError() {
        MonitorRequest request = new MonitorRequest("Test monitor", null, List.of(), Map.of(),
                List.of(new MonitorRequest.Rule("invalid", null, "plan", null, null,
                        List.of(new TripMonitor.Action(null, null)), null, null)), MonitorScope.ANY);
        assertThrows(IllegalArgumentException.class,
                () -> service.saveDraft("test", "test", "test-monitor", request));
    }

    private class TestMonitors implements MonitorStore {
        private TripMonitor draft;
        public void lock(String tenant, String key) { assertTrue(transaction); locked = true; }
        public List<TripMonitor> all(String tenant) { return List.of(draft); }
        public List<TripMonitor> versions(String tenant, String key) {
            assertTrue(locked, "publishing must lock before reading the version to validate");
            return List.of(draft);
        }
        public Optional<TripMonitor> version(String tenant, String key, int version) { return Optional.of(draft); }
        public TripMonitor saveDraft(TripMonitor value) { assertTrue(locked); draft = value; return value; }
        public Optional<TripMonitor> publish(String tenant, String key, String actor) {
            assertTrue(locked, "the validation lock must still be held when publishing");
            return Optional.of(draft);
        }
        public boolean deleteDraft(String tenant, String key) { assertTrue(locked); draft = null; return true; }
        public List<String> orderTypes(String tenant) { return List.of(); }
    }
}

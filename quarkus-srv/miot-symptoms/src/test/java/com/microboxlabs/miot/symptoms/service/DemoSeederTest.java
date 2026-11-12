package com.microboxlabs.miot.symptoms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.store.InMemoryContactStore;
import com.microboxlabs.miot.symptoms.store.InMemoryTreatmentStore;
import java.util.List;
import org.junit.jupiter.api.Test;

class DemoSeederTest {

    @Test
    void historyIsDeterministicClosedAndMarkedAsDemo() {
        List<String> first = shape("tenant-a");
        List<String> second = shape("tenant-a");
        assertEquals(first, second);

        var contacts = new InMemoryContactStore();
        var treatments = new InMemoryTreatmentStore();
        var seeder = new DemoSeeder(true, contacts, treatments);
        int withHistory = 0;
        for (long symptom = 1; symptom <= 30; symptom++) {
            seeder.ensureHistory("tenant-a", symptom);
            seeder.ensureHistory("tenant-a", symptom);
            List<Treatment> episodes = treatments.listBySymptom("tenant-a", symptom);
            assertTrue(episodes.size() <= 2);
            if (!episodes.isEmpty()) {
                withHistory++;
            }
            for (Treatment t : episodes) {
                assertEquals(TreatmentStatus.CLOSED, t.status());
                List<TreatmentAction> actions = treatments.listActions("tenant-a", List.of(t.id()));
                assertEquals(ActionKind.CALL, actions.get(0).kind());
                assertTrue(actions.stream().allMatch(a -> Boolean.TRUE.equals(a.details().get("demo"))));
            }
        }
        assertTrue(withHistory > 0 && withHistory < 30, "some symptoms have history, some do not");
    }

    @Test
    void disabledSeederWritesNothing() {
        var contacts = new InMemoryContactStore();
        var treatments = new InMemoryTreatmentStore();
        var seeder = new DemoSeeder(false, contacts, treatments);
        seeder.ensureContacts("t");
        seeder.ensureHistory("t", 1L);
        assertTrue(contacts.isEmpty("t"));
        assertTrue(treatments.listBySymptom("t", 1L).isEmpty());
    }

    @Test
    void engineCasesThatClosedOrWentOnHoldDoNotFailDemoReads() {
        for (String reason : List.of("the case is closed", "the case is on hold")) {
            var contacts = new InMemoryContactStore();
            List<Long> attempts = new java.util.ArrayList<>();
            var treatments = new InMemoryTreatmentStore() {
                @Override
                public synchronized Inserted insert(Treatment treatment) {
                    attempts.add(treatment.symptomId());
                    throw new IllegalStateException(reason);
                }
            };
            var seeder = new DemoSeeder(true, contacts, treatments);
            for (long id = -1; id >= -30; id--) {
                seeder.ensureHistory("test-tenant", id);
            }
            assertTrue(!attempts.isEmpty(), "exercise a synthetic insert, not only zero-history cases");
            assertThrows(IllegalStateException.class, () -> {
                for (long id = 1; id <= 30; id++) seeder.ensureHistory("test-tenant", id);
            }, "legacy insert failures must still surface");
        }
    }

    @Test
    void anUnrelatedEngineHistoryFailureStillSurfaces() {
        var contacts = new InMemoryContactStore();
        var treatments = new InMemoryTreatmentStore() {
            @Override
            public synchronized Inserted insert(Treatment treatment) {
                throw new IllegalStateException("test-database-unavailable");
            }
        };
        var seeder = new DemoSeeder(true, contacts, treatments);
        assertThrows(IllegalStateException.class, () -> {
            for (long id = -1; id >= -30; id--) seeder.ensureHistory("test-tenant", id);
        });
    }

    private static List<String> shape(String tenant) {
        var contacts = new InMemoryContactStore();
        var treatments = new InMemoryTreatmentStore();
        var seeder = new DemoSeeder(true, contacts, treatments);
        seeder.ensureHistory(tenant, 5668935L);
        return treatments.listBySymptom(tenant, 5668935L).stream()
                .flatMap(t -> treatments.listActions(tenant, List.of(t.id())).stream())
                .map(a -> a.kind() + ":" + a.contactName() + ":" + a.outcomeKey())
                .toList();
    }
}

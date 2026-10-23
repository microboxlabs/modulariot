package com.microboxlabs.miot.symptoms.cases;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.symptoms.events.SymptomCaseData;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;

class SlaTimerTest {

    private static final String TENANT = "tenant-demo";
    private static final Instant OPENED = Instant.parse("2026-10-22T03:00:00Z");
    private static final Instant NOW = OPENED.plus(Duration.ofMinutes(20));
    private static final UUID SPEEDING = UUID.randomUUID();

    /** The due cases as the SQL gives them: a case and level already marked is no longer due. */
    private static final class InMemorySlaStore implements SlaStore {
        final List<Due> due = new ArrayList<>();
        final Set<String> marks = new HashSet<>();
        Instant openedAfter;

        @Override
        public List<Due> due(Instant openedAfter, Instant now, int limit) {
            this.openedAfter = openedAfter;
            return due.stream().filter(d -> !marks.contains(key(d.tenantCode(), d.engineCase().id(),
                    d.engineCase().level()))).toList();
        }

        @Override
        public boolean markExpired(String tenantCode, long caseId, int level, int slaMinutes, Instant at) {
            return marks.add(key(tenantCode, caseId, level));
        }

        private static String key(String tenant, long caseId, int level) {
            return tenant + "/" + caseId + "/" + level;
        }
    }

    private final InMemorySlaStore store = new InMemorySlaStore();
    private final List<OperationalEvent> fired = new ArrayList<>();
    private final SymptomEvents events = new SymptomEvents(e -> {
        fired.add(e);
        return CompletableFuture.completedFuture(e);
    });

    private SlaTimer timer(boolean enabled) {
        return new SlaTimer(enabled, Duration.ofDays(7), store, events, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static SlaStore.Due due(long id, int level, int slaMinutes) {
        EngineCase c = new EngineCase(id, SPEEDING, "1.0.0", null, null, "DEMO01", OPENED, level, "T-1", -33.4,
                -70.6, 95.0, null, 0, slaMinutes, null);
        return new SlaStore.Due(TENANT, c, OPENED.plusSeconds(60), slaMinutes);
    }

    @Test
    void anUnattendedCasePublishesItsSlaExpiryOnce() {
        store.due.add(due(12, 3, 15));
        SlaTimer t = timer(true);

        assertEquals(1, t.run());
        assertEquals(0, t.run(), "the next run finds it marked");

        assertEquals(1, fired.size());
        OperationalEvent e = fired.get(0);
        assertEquals("symptom.case.sla_expired", e.type());
        assertEquals("symptom_case", e.context().kind());
        assertEquals("-12", e.context().key());
        assertEquals(NOW, e.at());
        assertFalse(e.test());
        SymptomCaseData data = (SymptomCaseData) e.data();
        assertEquals(3, data.level());
        assertEquals(15, data.slaMinutes());
        assertEquals(OPENED.plusSeconds(60), data.levelSince());
        assertEquals(SPEEDING, data.definitionId());
        assertEquals(NOW.minus(Duration.ofDays(7)), store.openedAfter);
    }

    @Test
    void aHigherLevelExpiresAgain() {
        store.due.add(due(12, 3, 15));
        SlaTimer t = timer(true);
        t.run();

        store.due.set(0, due(12, 4, 5));
        t.run();

        assertEquals(List.of(3, 4), fired.stream().map(e -> ((SymptomCaseData) e.data()).level()).toList());
    }

    @Test
    void twoPodsPublishTheExpiryOnce() {
        store.due.add(due(12, 3, 15));
        // Both read the case as due before either marks it.
        List<SlaStore.Due> seen = List.copyOf(store.due);
        SlaStore racing = new SlaStore() {
            @Override
            public List<Due> due(Instant openedAfter, Instant now, int limit) {
                return seen;
            }

            @Override
            public boolean markExpired(String tenantCode, long caseId, int level, int slaMinutes, Instant at) {
                return store.markExpired(tenantCode, caseId, level, slaMinutes, at);
            }
        };
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

        int published = new SlaTimer(true, Duration.ofDays(7), racing, events, clock).run()
                + new SlaTimer(true, Duration.ofDays(7), racing, events, clock).run();

        assertEquals(1, published);
        assertEquals(1, fired.size());
    }

    @Test
    void doesNothingWhenOffOrWhenTheStoreFails() {
        store.due.add(due(12, 3, 15));
        timer(false).tick();
        assertTrue(fired.isEmpty());

        SlaStore down = new SlaStore() {
            @Override
            public List<Due> due(Instant openedAfter, Instant now, int limit) {
                throw new IllegalStateException("database down");
            }

            @Override
            public boolean markExpired(String tenantCode, long caseId, int level, int slaMinutes, Instant at) {
                throw new IllegalStateException("database down");
            }
        };
        new SlaTimer(true, Duration.ofDays(7), down, events, Clock.fixed(NOW, ZoneOffset.UTC)).tick();
        assertTrue(fired.isEmpty());
    }
}

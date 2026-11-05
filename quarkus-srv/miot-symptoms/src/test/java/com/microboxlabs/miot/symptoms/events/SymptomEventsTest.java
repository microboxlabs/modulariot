package com.microboxlabs.miot.symptoms.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog.Place;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog.Recorded;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;

class SymptomEventsTest {

    private static final String TENANT = "tenant-demo";
    private static final Instant T0 = Instant.parse("2026-10-22T03:00:00Z");
    private static final UUID PANIC = UUID.randomUUID();

    private final List<OperationalEvent> fired = new ArrayList<>();
    private final List<UUID> lookups = new ArrayList<>();
    private Instant now = T0;
    private boolean catalogDown;

    private final Clock clock = new Clock() {
        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    };

    private final SymptomEvents events = new SymptomEvents(e -> {
        fired.add(e);
        return CompletableFuture.completedFuture(e);
    }, (tenant, id) -> {
        lookups.add(id);
        if (catalogDown) {
            throw new IllegalStateException("database down");
        }
        return Optional.of(new SymptomDefinition(id, tenant, "panic-button", "Botón de pánico", null, null, null,
                "gps_signal", null, null, null, null, SymptomState.ACTIVE, "0.1.0", "t", null, "t", null));
    }, clock);

    private void open(int caseId) {
        Transition t = new Transition(Transition.Kind.OPENED, PANIC, "0.1.0", SymptomState.ACTIVE, "DEMO01", now, 4,
                0, 0);
        events.transitions(TENANT, List.of(new Recorded(t, caseId)), new Place("T-1", null, null, null, "D-7"));
    }

    private SymptomCaseData last() {
        return (SymptomCaseData) fired.get(fired.size() - 1).data();
    }

    @Test
    void readsTheSymptomsNameOnceWithinItsTtl() {
        open(1);
        now = T0.plusSeconds(20);
        open(2);
        now = T0.plus(Duration.ofSeconds(31));
        open(3);

        assertEquals(2, lookups.size(), "again after 30 s");
        assertEquals("panic-button", last().symptomKey());
        assertEquals("Botón de pánico", last().symptomName());
        assertEquals("D-7", last().driverId());
    }

    @Test
    void publishesWithoutTheNameWhenTheCatalogCannotBeRead() {
        catalogDown = true;

        open(1);

        assertEquals(1, fired.size());
        assertNull(last().symptomKey());
        assertNull(last().symptomName());
    }
}

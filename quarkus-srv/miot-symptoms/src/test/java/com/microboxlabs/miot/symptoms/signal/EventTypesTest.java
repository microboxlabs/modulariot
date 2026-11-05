package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class EventTypesTest {

    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-01-10T12:00:00Z"));
    private final Clock clock = new Clock() {
        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now.get();
        }
    };
    private final EventTypes types = new EventTypes(null, clock);

    private static Map<String, Object> frame(String... eventTypes) {
        return Map.of("frame", Map.of("events", java.util.Arrays.stream(eventTypes)
                .map(t -> Map.of("event_type", t, "description", "x")).toList()));
    }

    @Test
    void countsEachTypeOncePerFrameMostFrequentFirst() {
        types.count("tenant-a", frame("gps_jamming", "gps_jamming", "device_tamper"));
        types.count("tenant-a", frame("device_tamper"));
        types.count("tenant-a", frame(" ", "main_power_disconnect"));
        types.count("tenant-b", frame("other_code"));

        assertEquals(List.of(new EventTypes.Count("device_tamper", 2), new EventTypes.Count("gps_jamming", 1),
                new EventTypes.Count("main_power_disconnect", 1)), types.recent("tenant-a", 7));
    }

    @Test
    void readsOnlyTheDaysAsked() {
        types.count("tenant-a", frame("gps_jamming"));
        now.set(now.get().plus(Duration.ofDays(3)));
        types.count("tenant-a", frame("device_tamper"));

        assertEquals(List.of(new EventTypes.Count("device_tamper", 1)), types.recent("tenant-a", 1));
        assertEquals(2, types.recent("tenant-a", 7).size());
        assertEquals(1, types.recent("tenant-a", 0).size(), "at least today");
    }

    @Test
    void keepsAtMostTheCappedNumberOfTypesADay() {
        for (int i = 0; i < EventTypes.MAX_TYPES + 10; i++) {
            types.count("tenant-a", frame("code_" + i));
        }
        types.count("tenant-a", frame("code_0"));

        List<EventTypes.Count> recent = types.recent("tenant-a", 1);
        assertEquals(EventTypes.MAX_TYPES, recent.size());
        assertEquals(new EventTypes.Count("code_0", 2), recent.get(0));
    }

    @Test
    void aFrameWithoutEventsCountsNothing() {
        types.count("tenant-a", Map.of("frame", Map.of()));
        types.count("tenant-a", Map.of());

        assertEquals(List.of(), types.recent("tenant-a", 7));
    }

    @Test
    void suggestionsKeepExactCodesAndOmitOversizedOnes() {
        String prefix = "x".repeat(EventTypes.MAX_LENGTH);
        types.count("tenant-a", frame(" code ", prefix, prefix + "a", prefix + "b"));

        assertEquals(List.of(new EventTypes.Count(" code ", 1), new EventTypes.Count(prefix, 1)),
                types.recent("tenant-a", 7));
    }

    @Test
    void anotherTenantsActivityPrunesInactiveTenantsDays() {
        Instant first = now.get();
        types.count("tenant-a", frame("old_event"));
        now.set(first.plus(Duration.ofDays(EventTypes.MAX_DAYS + 1L)));
        types.count("tenant-b", frame("new_event"));
        now.set(first);

        assertEquals(List.of(), types.recent("tenant-a", 1), "the old day was removed from memory");
    }
}

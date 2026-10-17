package com.microboxlabs.miot.fleet.directory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ActivityRollupTest {

    private static final Instant NOW = Instant.parse("2026-10-14T15:20:00Z");
    private static final ZoneId ZONE = ZoneId.of("America/Santiago");

    /** Records which hours were asked for. */
    private static final class Recording extends DemoFleetData {

        final List<Instant> asked = new ArrayList<>();

        Recording() {
            super(() -> NOW);
        }

        @Override
        public List<ActivityHour> activity(Instant from, Instant to) {
            asked.add(from);
            return super.activity(from, to);
        }
    }

    @Test
    void recomputesRecentHoursAndBackfillsOlderOnesInSteps() {
        Recording data = new Recording();
        InMemoryActivityStore store = new InMemoryActivityStore();
        ActivityRollup rollup = new ActivityRollup(data, store, Clock.fixed(NOW, ZoneOffset.UTC), ZONE,
                Duration.ofHours(8), 4);

        rollup.run();
        assertEquals(List.of(Instant.parse("2026-10-14T13:00:00Z"), Instant.parse("2026-10-14T14:00:00Z"),
                Instant.parse("2026-10-14T15:00:00Z"), Instant.parse("2026-10-14T12:00:00Z"),
                Instant.parse("2026-10-14T11:00:00Z"), Instant.parse("2026-10-14T10:00:00Z"),
                Instant.parse("2026-10-14T09:00:00Z")), data.asked);
        assertEquals(Instant.parse("2026-10-14T09:00:00Z"), store.cursor(ActivityRollup.BACKFILL_CURSOR).orElseThrow());

        data.asked.clear();
        rollup.run();
        assertEquals(Instant.parse("2026-10-14T07:00:00Z"), data.asked.get(data.asked.size() - 1));
        assertEquals(5, data.asked.size());

        LocalDate today = LocalDate.of(2026, 10, 14);
        ActivityDay day = store.days("DEMO-TR1", today, today).get(0);
        assertEquals(6 * 3300, day.engineSeconds());
        assertTrue(store.totals(Set.of("DEMO-TR1", "DEMO-JX1"), today, today).containsKey("DEMO-TR1"));
    }

    @Test
    void recoversHoursMissedWhileStopped() {
        Recording data = new Recording();
        InMemoryActivityStore store = new InMemoryActivityStore();
        Instant[] now = {NOW};
        Clock clock = new Clock() {
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
                return now[0];
            }
        };
        ActivityRollup rollup = new ActivityRollup(data, store, clock, ZONE, Duration.ofHours(48), 2);
        rollup.run();

        now[0] = NOW.plus(Duration.ofHours(6));
        data.asked.clear();
        rollup.run();
        assertEquals(List.of(Instant.parse("2026-10-14T19:00:00Z"), Instant.parse("2026-10-14T20:00:00Z"),
                Instant.parse("2026-10-14T21:00:00Z"), Instant.parse("2026-10-14T16:00:00Z"),
                Instant.parse("2026-10-14T17:00:00Z")), data.asked);

        data.asked.clear();
        rollup.run();
        assertEquals(Instant.parse("2026-10-14T18:00:00Z"), data.asked.get(3));
        assertEquals(Instant.parse("2026-10-14T21:00:00Z"),
                store.cursor(ActivityRollup.LATEST_CURSOR).orElseThrow());
    }

    @Test
    void aRecomputedDayWithNoHoursLeftIsRemoved() {
        InMemoryActivityStore store = new InMemoryActivityStore();
        Instant hour = Instant.parse("2026-10-14T15:00:00Z");
        Instant end = hour.plus(Duration.ofHours(1));
        store.saveHours(hour, end, List.of(new ActivityHour("A", hour, 10, 600, 0, 600, 5)), ZONE);
        LocalDate day = LocalDate.of(2026, 10, 14);
        assertEquals(1, store.days("A", day, day).size());

        store.saveHours(hour, end, List.of(), ZONE);
        assertTrue(store.days("A", day, day).isEmpty());
    }
}

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
}

package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class CoverageAndCohortTest {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private final CoverageMap map = CoverageMap.defaults();

    @Test
    void cellsAreAGridOfFiveHundredthsOfADegree() {
        assertEquals("-661:-1421", CoverageMap.cell(-33.02, -71.01));
        assertEquals(CoverageMap.cell(-33.01, -71.001), CoverageMap.cell(-33.049, -71.049));
        assertNull(CoverageMap.cell(null, -71.0));
        assertNull(CoverageMap.cell(0.0, 0.0), "no fix");
    }

    @Test
    void aFrameIsDelayedAgainstItsSendersOwnDelay() {
        Frame late = new Frame("V1", "S1", T0, T0.plusSeconds(600), null, null, 0.0, true);
        SenderProfile onTime = SenderProfile.empty();
        SenderProfile batching = SenderProfile.empty();
        for (int i = 0; i < 50; i++) {
            batching = batching.with(new Frame("V2", "S1", T0, T0.plusSeconds(1200), null, null, 0.0, true),
                    LossSettings.defaults(), false);
        }

        assertTrue(CoverageMap.delayed(late, onTime));
        assertFalse(CoverageMap.delayed(late, batching), "10 min is usual for a sender that forwards in batches");
    }

    @Test
    void aCellIsLowCoverageWhenItsDelayedShareIsWellAboveTheSenders() {
        Coverage c = null;
        for (int i = 0; i < 30; i++) {
            c = Coverage.with(c, i % 2 == 0, T0.plusSeconds(i), Duration.ofDays(7));
        }
        assertEquals(0.5, c.share(), 0.01);

        assertTrue(map.lowCoverage(c, 0.05, null));
        assertFalse(map.lowCoverage(c, 0.3, null), "the sender is delayed everywhere: not the cell");
        assertTrue(map.lowCoverage(null, 0.3, c), "every sender together is delayed there");
        assertFalse(map.lowCoverage(Coverage.with(null, true, T0, Duration.ofDays(7)), 0, null), "too few frames");
    }

    @Test
    void oldFramesFadeByHalfEveryHalfLife() {
        Coverage c = new Coverage(10, 10, T0);

        Coverage later = Coverage.with(c, false, T0.plus(Duration.ofDays(7)), Duration.ofDays(7));

        assertEquals(6, later.frames(), 0.001);
        assertEquals(5, later.delayed(), 0.001);
    }

    @Test
    void anOutageIsManyLostAgainstTheSendersUsualCount() {
        assertFalse(Cohort.outage(null, 2));
        assertTrue(Cohort.outage(null, 3));
        Cohort usual = new Cohort(4, T0);
        assertFalse(Cohort.outage(usual, 6), "a sender that usually has 4 lost");
        assertTrue(Cohort.outage(usual, 12));

        Cohort moved = Cohort.with(usual, 12, T0.plus(Cohort.HALF_LIFE));
        assertEquals(8, moved.baseline(), 0.001, "half way after one half-life");
    }

    @Test
    void nearbyCountsOtherVehiclesThatReportedInTheLastTenMinutes() {
        TestClock clock = new TestClock(T0);
        InMemoryLossStore store = new InMemoryLossStore(clock);
        VehicleProfile p = VehicleProfile.first(new Frame("A", null, T0, T0, -33.0, -71.0, 0.0, true));
        store.save("A", p, null, null, LossStore.Schedule.KEEP, null,
                new LossStore.Cells(null, null, null, -33.0, -71.0));
        store.save("B", p, null, null, LossStore.Schedule.KEEP, null,
                new LossStore.Cells(null, null, null, -33.05, -71.0));
        store.save("C", p, null, null, LossStore.Schedule.KEEP, null,
                new LossStore.Cells(null, null, null, -34.0, -71.0));

        assertEquals(1, store.around(null, null, -33.0, -71.0, "A", T0, 10).nearby(), "B, 5.6 km; C is 111 km off");
        assertEquals(0, store.around(null, null, -33.0, -71.0, "A", T0.plusSeconds(601), 10).nearby());
    }
}

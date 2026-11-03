package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class CoverageAndCohortTest {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");

    @Test
    void cellsAreAGridOfFiveHundredthsOfADegree() {
        assertEquals("-661:-1421", CoverageMap.cell(-33.02, -71.01));
        assertEquals(CoverageMap.cell(-33.01, -71.001), CoverageMap.cell(-33.049, -71.049));
        assertNull(CoverageMap.cell(null, -71.0));
        assertNull(CoverageMap.cell(0.0, 0.0), "no fix");
    }

    @Test
    void anOutageIsManyLostAgainstTheSendersUsualCount() {
        assertFalse(Cohort.outage(null, 2));
        assertTrue(Cohort.outage(null, 3));
        Cohort usual = new Cohort(4, T0, 12);
        assertFalse(Cohort.outage(usual, 6), "a sender that usually has 4 lost");
        assertTrue(Cohort.outage(usual, 12));

        Cohort moved = Cohort.with(usual, 12, T0.plus(Cohort.HALF_LIFE));
        assertEquals(8, moved.baseline(), 0.001, "12 held for one half-life: half way");

        Cohort quiet = Cohort.with(new Cohort(4, T0, 0), 5, T0.plus(Cohort.HALF_LIFE));
        assertEquals(2, quiet.baseline(), 0.001, "a quiet interval lowers the baseline before the new loss");
        assertEquals(5, quiet.count());
    }

    @Test
    void nearbyCountsOtherVehiclesThatReportedInTheLastTenMinutes() {
        TestClock clock = new TestClock(T0);
        InMemoryLossStore store = new InMemoryLossStore(clock);
        VehicleProfile p = VehicleProfile.first(new Frame("A", null, T0, T0, -33.0, -71.0, 0.0, true));
        store.save("A", p, null, null, LossStore.Schedule.KEEP, null,
                new LossStore.Reporting(-33.0, -71.0));
        store.save("B", p, null, null, LossStore.Schedule.KEEP, null,
                new LossStore.Reporting(-33.05, -71.0));
        store.save("C", p, null, null, LossStore.Schedule.KEEP, null,
                new LossStore.Reporting(-34.0, -71.0));

        assertEquals(1, store.nearby(-33.0, -71.0, "A", T0, 10), "B, 5.6 km; C is 111 km off");
        assertEquals(0, store.nearby(-33.0, -71.0, "A", T0.plusSeconds(601), 10));
    }
}

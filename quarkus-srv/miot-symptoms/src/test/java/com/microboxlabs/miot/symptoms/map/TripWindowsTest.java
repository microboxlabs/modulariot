package com.microboxlabs.miot.symptoms.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TripWindowsTest {

    private static final Instant DEPARTED = Instant.parse("2026-10-20T08:00:00Z");

    @Test
    void aRunningTripReadsUntilNowAndAnEndedOneUntilItsEnd() {
        Instant now = Instant.parse("2026-10-20T12:00:00Z");
        assertEquals(new TripWindows.Window(DEPARTED, now), TripWindows.window(DEPARTED, null, now));
        Instant ended = Instant.parse("2026-10-20T10:00:00Z");
        assertEquals(new TripWindows.Window(DEPARTED, ended), TripWindows.window(DEPARTED, ended, now));
    }

    @Test
    void theRangeIsAtMostSevenDaysFromTheDeparture() {
        Instant now = Instant.parse("2026-11-20T00:00:00Z");
        assertEquals(DEPARTED.plus(TripWindows.AT_MOST), TripWindows.window(DEPARTED, null, now).to());
    }

    @Test
    void aTripThatHasNotDepartedHasNoRange() {
        assertNull(TripWindows.window(null, null, DEPARTED).from());
    }

    @Test
    void onlyAUuidIsATripsModuleTrip() {
        UUID id = UUID.randomUUID();
        assertEquals(id, TripWindows.tripsModuleId(" " + id + " ").orElseThrow());
        assertTrue(TripWindows.tripsModuleId("1708205").isEmpty());
        assertTrue(TripWindows.tripsModuleId(null).isEmpty());
    }
}

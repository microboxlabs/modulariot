package com.microboxlabs.miot.symptoms.duty;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.duty.DutyTracker.Counters;
import com.microboxlabs.miot.symptoms.duty.DutyTracker.Frame;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class DutyTrackerTest {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    /** 60 km/h, 16.7 m/s: moving. */
    private static final double DRIVE_MPS = 16.7;
    private static final double METRES_PER_DEGREE = 6_371_000 * Math.PI / 180;

    /** A vehicle on one meridian: frames every {@code every} seconds, driving or parked. */
    private static final class Run {
        private final DutyTracker tracker = new DutyTracker();
        private final List<Counters> counters = new ArrayList<>();
        private DutyState state;
        private int at;
        private double metres;
        private String trip = "T-1";

        Run drive(int seconds, int every) {
            for (int s = every; s <= seconds; s += every) {
                at += every;
                metres += DRIVE_MPS * every;
                frame();
            }
            return this;
        }

        Run park(int seconds, int every) {
            for (int s = every; s <= seconds; s += every) {
                at += every;
                frame();
            }
            return this;
        }

        Run trip(String id) {
            trip = id;
            return this;
        }

        Counters frame() {
            DutyTracker.Step step = tracker.step(state, new Frame(T0.plusSeconds(at),
                    -60 + metres / METRES_PER_DEGREE, -70.0, null, trip)).orElseThrow();
            state = step.next();
            counters.add(step.counters());
            return step.counters();
        }

        Counters last() {
            return counters.get(counters.size() - 1);
        }
    }

    @Test
    void drivingCountsTheTimeBetweenMovingFrames() {
        Run r = new Run();
        r.frame();
        r.drive(270 * 60, 30);
        assertEquals(270.0, r.last().drivingMinutes(), 0.01);
        assertEquals(0.0, r.last().restingMinutes());
    }

    @Test
    void aStopUnder24MinutesPaysNothingBack() {
        Run r = new Run();
        r.frame();
        r.drive(3600, 30).park(23 * 60, 60);
        // The interval up to the first stopped frame is still driving.
        assertEquals(61.0, r.last().drivingMinutes(), 0.01);
        assertEquals(22.0, r.last().restingMinutes(), 0.01, "the stop counts from its first stopped frame");
    }

    @Test
    void aStopOf24MinutesPaysBackTwoAndAHalfTimesItsLength() {
        Run r = new Run();
        r.frame();
        r.drive(5 * 3600, 30).park(25 * 60, 60);
        // 300 min driving plus the interval to the first stopped frame; the stop is 24 min long at the last frame.
        assertEquals(301 - 60, r.last().drivingMinutes(), 0.01);
        r.park(24 * 60, 60);
        assertEquals(301 - 120, r.last().drivingMinutes(), 0.01, "the payback keeps growing with the stop");
        r.drive(600, 30);
        assertEquals(301 - 120 + 10, r.last().drivingMinutes(), 0.01, "driving again keeps what was paid back");
    }

    @Test
    void neverPaysBackMoreThanWasDrivenAndThenStartsAgain() {
        Run r = new Run();
        r.frame();
        r.drive(1800, 30).park(3 * 3600, 60);
        assertEquals(0.0, r.last().drivingMinutes(), 0.01, "all 31 min paid back, no more");
        r.drive(600, 30);
        assertEquals(10.0, r.last().drivingMinutes(), 0.5, "the count starts again after all driving was paid back");
    }

    @Test
    void aNewTripOrNoTripStartsAgain() {
        Run r = new Run();
        r.frame();
        r.drive(3600, 30);
        r.trip("T-2").drive(30, 30);
        assertEquals(0.0, r.last().drivingMinutes());
        assertEquals(0.0, r.last().dutyMinutes());
        r.drive(600, 30);
        assertEquals(10.0, r.last().drivingMinutes(), 0.01);
        r.trip(null).drive(30, 30);
        assertEquals(new Counters(0, 0, 0), r.last());
        assertNull(r.state.drive());
        assertNull(r.state.rest());
    }

    @Test
    void dutyStartsAtTheFirstMovementAndCountsStops() {
        Run r = new Run();
        r.frame();
        r.park(3600, 60);
        assertEquals(0.0, r.last().dutyMinutes(), "parked at the trip start: duty waits");
        r.drive(3600, 30).park(2 * 3600, 60);
        assertEquals(180.0, r.last().dutyMinutes(), 0.01,
                "from the frame before the first movement, stops included");
        assertEquals(119.0, r.last().restingMinutes(), 0.01);
    }

    @Test
    void aRestOf8HoursEndsTheDuty() {
        Run r = new Run();
        r.frame();
        r.drive(17 * 3600, 30);
        assertTrue(r.last().dutyMinutes() > 975);
        r.park(8 * 3600 + 60, 60);
        assertEquals(0.0, r.last().dutyMinutes(), "the frame that completes the rest has no duty");
        assertEquals(480.0, r.last().restingMinutes(), 0.01);
        assertNull(r.state.rest());
        r.park(600, 60);
        assertEquals(0.0, r.last().dutyMinutes(), "still parked: duty waits for movement");
        r.drive(600, 30);
        assertEquals(10.0, r.last().dutyMinutes(), 0.01);
    }

    @Test
    void theRestIsZeroWhileMovingEvenPastTheDutyLimit() {
        Run r = new Run();
        r.frame();
        r.drive(17 * 3600, 30).park(3600, 60);
        assertEquals(59.0, r.last().restingMinutes(), 0.01);
        r.drive(600, 30);
        assertEquals(0.0, r.last().restingMinutes(), "the legacy kept counting here; the tracker does not");
        r.park(600, 60);
        assertEquals(9.0, r.last().restingMinutes(), 0.01, "a new stop counts from its own first frame");
    }

    @Test
    void framesItCannotUseChangeNothing() {
        DutyTracker t = new DutyTracker();
        DutyState s = t.step(null, new Frame(T0, -33.0, -70.0, 0.0, "T-1")).orElseThrow().next();

        assertTrue(t.step(s, new Frame(T0.plusSeconds(30), null, null, 0.0, "T-1")).isEmpty(), "no position");
        assertTrue(t.step(s, new Frame(T0.plusSeconds(30), 0.0, 0.0, 0.0, "T-1")).isEmpty(), "0,0");
        assertTrue(t.step(s, new Frame(T0.plusSeconds(30), -33.0, -70.0, 151.0, "T-1")).isEmpty(), "speed");
        assertTrue(t.step(s, new Frame(T0.plusSeconds(30), -33.0, -70.0, -1.0, "T-1")).isEmpty(), "speed");
        assertTrue(t.step(s, new Frame(T0, -33.0, -70.0, 0.0, "T-1")).isEmpty(), "a replay");
        assertTrue(t.step(s, new Frame(T0.minusSeconds(30), -33.0, -70.0, 0.0, "T-1")).isEmpty(), "older");
        assertTrue(t.step(s, new Frame(T0.plusSeconds(30), -33.1, -70.0, 0.0, "T-1")).isEmpty(),
                "11 km in 30 s");
        DutyTracker.Step next = t.step(s, new Frame(T0.plusSeconds(30), -33.0, -70.0, 0.0, "T-1")).orElseThrow();
        assertFalse(next.moving());
        assertTrue(t.step(s, new Frame(T0.plusSeconds(30), -33.001, -70.0, 50.0, "T-1")).orElseThrow().moving(),
                "111 m in 30 s: moving, whatever the device speed");
    }

    @Test
    void restartingDutyWaitsForTheNextMovement() {
        Run r = new Run();
        r.frame();
        r.drive(17 * 3600, 30);
        r.state = DutyTracker.restartDuty(r.state, 1);
        r.drive(600, 30);
        assertEquals(9.5, r.last().dutyMinutes(), 0.01, "from the first frame after the restart");
        assertEquals(1, r.state.restarts());
        assertTrue(r.last().drivingMinutes() > 1000, "a duty restart leaves the driving count");
    }

    @Test
    void theStateSurvivesJson() {
        Run r = new Run();
        r.frame();
        r.drive(3600, 30).park(1800, 60);
        assertEquals(r.state, RedisDutyStore.read(RedisDutyStore.write(r.state)));
    }
}

package com.microboxlabs.miot.symptoms.duty;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.duty.DutyTracker.Counters;
import com.microboxlabs.miot.symptoms.duty.DutyTracker.Frame;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
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

    /** A frame {@code seconds} after T0, {@code metres} north of a synthetic point on a meridian. */
    private static Frame at(int seconds, double metres) {
        return new Frame(T0.plusSeconds(seconds), -60 + metres / METRES_PER_DEGREE, -70.0, null, "T-1");
    }

    /** Applies the frames in order; returns the highest driving minutes published. */
    private static double maxDriving(DutyTracker t, DutyState[] state, List<Frame> frames) {
        double max = 0;
        for (Frame f : frames) {
            var step = t.step(state[0], f);
            if (step.isEmpty()) {
                continue;
            }
            state[0] = step.get().next();
            if (step.get().applied()) {
                max = Math.max(max, step.get().counters().drivingMinutes());
            }
        }
        return max;
    }

    @Test
    void framesBufferedDuringAStopAndSentNewestFirstDoNotCountTheGapAsDriving() {
        DutyTracker t = new DutyTracker();
        DutyState[] s = {null};
        List<Frame> live = new ArrayList<>();
        double m = 0;
        for (int at = 0; at <= 3600; at += 30, m += DRIVE_MPS * 30) {
            live.add(at(at, m));
        }
        assertEquals(60.0, maxDriving(t, s, live), 0.01);
        // Quiet from 1 h: stopped from 1 h 10 min to 4 h, moving again from 4 h 05 min. At 4 h 20 min the device
        // sends what it buffered, newest first.
        List<Frame> buffered = new ArrayList<>();
        for (int at = 3630; at <= 4200; at += 30) {
            buffered.add(at(at, m += DRIVE_MPS * 30));
        }
        double parked = m;
        for (int at = 4260; at <= 14_400; at += 60) {
            buffered.add(at(at, parked));
        }
        for (int at = 14_700; at <= 15_600; at += 30) {
            buffered.add(at(at, m += DRIVE_MPS * 30));
        }
        List<Frame> newestFirst = new ArrayList<>(buffered);
        Collections.reverse(newestFirst);
        double burst = maxDriving(t, s, newestFirst);
        assertEquals(60.0, burst, 0.01, "4 h 20 min since the last frame: unobserved, not driving");
        assertEquals(T0.plusSeconds(15_600), s[0].at(), "only the newest buffered frame is applied");
        List<Frame> after = new ArrayList<>();
        for (int at = 15_630; at <= 15_600 + 1800; at += 30) {
            after.add(at(at, m += DRIVE_MPS * 30));
        }
        assertEquals(90.0, maxDriving(t, s, after), 0.01, "driving counts again from the newest buffered frame");
    }

    @Test
    void aFarFrameAfterAGapStartsFromItInsteadOfTheOldPosition() {
        DutyTracker t = new DutyTracker();
        DutyState[] s = {null};
        List<Frame> frames = new ArrayList<>();
        for (int at = 0; at <= 9600; at += 2400) {
            frames.add(at(at, 0));
        }
        // Silent for 1 h 50 min, then 200 km away and driving at 88 km/h for 3 h, a frame every 3 s.
        double m = 200_000;
        for (int at = 16_200; at <= 16_200 + 3 * 3600; at += 3, m += 88 / 3.6 * 3) {
            frames.add(at(at, m));
        }
        double max = maxDriving(t, s, frames);
        assertEquals(180.0, max, 0.1, "3 h of driving after the gap, not the 4 h 50 min since the old position");
        assertTrue(max < 270);
    }

    @Test
    void twoFramesThatAgreeReplaceAStaleLastPosition() {
        DutyTracker t = new DutyTracker();
        DutyState[] s = {null};
        List<Frame> frames = new ArrayList<>();
        frames.add(at(0, 0));
        // 20 min later the vehicle reports 60 km away (180 km/h from the last position), then drives for 30 min.
        double m = 60_000;
        for (int at = 1200; at <= 3000; at += 30, m += DRIVE_MPS * 30) {
            frames.add(at(at, m));
        }
        assertEquals(30.0, maxDriving(t, s, frames), 0.01,
                "driving counts from the first far frame; the 20 min before it are unobserved");
    }

    @Test
    void aStalePositionBetweenLiveFramesIsSkipped() {
        DutyTracker t = new DutyTracker();
        DutyState[] s = {null};
        List<Frame> frames = new ArrayList<>();
        double m = 0;
        for (int at = 0; at <= 3600; at += 30, m += DRIVE_MPS * 30) {
            frames.add(at(at, m));
            frames.add(at(at + 15, -80_000));
        }
        assertEquals(60.0, maxDriving(t, s, frames), 0.01);
        assertEquals(T0.plusSeconds(3600), s[0].at());
    }

    @Test
    void aGapAfterAStopIsRestAndAGapAfterDrivingIsNeither() {
        Run stopped = new Run();
        stopped.frame();
        stopped.drive(3600, 30).park(600, 60);
        assertEquals(61.0, stopped.last().drivingMinutes(), 0.01);
        stopped.at += 2 * 3600;
        assertEquals(0.0, stopped.frame().drivingMinutes(), 0.01, "a 2 h 9 min stop pays back all 61 min");
        assertEquals(129.0, stopped.last().restingMinutes(), 0.01);

        Run moving = new Run();
        moving.frame();
        moving.drive(3600, 30);
        moving.at += 2 * 3600;
        Counters gap = moving.frame();
        assertEquals(60.0, gap.drivingMinutes(), 0.01, "the 2 h after the last moving frame are not driving");
        assertEquals(0.0, gap.restingMinutes(), "nor rest: the stop starts at this frame");
        moving.park(1440, 60);
        assertEquals(0.0, moving.last().drivingMinutes(), 0.01, "a 24 min stop from there pays back the hour");
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
    void theFullyRepaidRestartPublishesZeroBeforeTheNextFrameIncludesItsDriving() {
        DutyTracker tracker = new DutyTracker();
        DutyState repaid = new DutyState(T0, -33, -70,
                new DutyState.Drive("T-1", false, 3600, 0, 0, 3600, 1440), null, 0);
        Frame resumed = new Frame(T0.plusSeconds(1800), -32.9, -70.0, 60.0, "T-1");

        var restart = tracker.step(repaid, resumed).orElseThrow();

        assertEquals(0.0, restart.counters().drivingMinutes(), "the legacy restart frame returns a zero check");
        assertEquals(1800, restart.next().drive().run(), "the driving interval is saved");
        var next = tracker.step(restart.next(), new Frame(resumed.at().plusSeconds(30), -32.899,
                -70.0, 60.0, "T-1")).orElseThrow();
        assertEquals(30.5, next.counters().drivingMinutes(), 0.01, "the next frame includes that interval");
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
        assertEquals(9.0, r.last().restingMinutes(), 0.01, "the legacy starts a new rest cycle after 8 h");
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
        DutyTracker.Step jump = t.step(s, new Frame(T0.plusSeconds(30), -33.1, -70.0, 0.0, "T-1")).orElseThrow();
        assertFalse(jump.applied(), "11 km in 30 s");
        assertEquals(s.at(), jump.next().at(), "the last applied frame stays");
        assertEquals(T0.plusSeconds(30), jump.next().skipped().at(), "the jump is kept");
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
        DutyState kept = new DutyState(T0, -33, -70, null, null, 0, new DutyState.Fix(T0.plusSeconds(30), -33.1, -70));
        assertEquals(kept, RedisDutyStore.read(RedisDutyStore.write(kept)));
        assertNull(RedisDutyStore.read("{\"at\":\"2026-01-01T00:00:00Z\",\"lat\":-33,\"lon\":-70,\"restarts\":0}")
                .skipped(), "a state saved before the field reads without it");
    }
}

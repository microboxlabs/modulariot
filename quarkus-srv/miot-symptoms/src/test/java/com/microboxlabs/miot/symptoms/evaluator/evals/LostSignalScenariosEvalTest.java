package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import com.microboxlabs.miot.symptoms.evaluator.evals.LostSignalReplay.Change;
import com.microboxlabs.miot.symptoms.evaluator.evals.LostSignalReplay.Frame;
import com.microboxlabs.miot.symptoms.evaluator.evals.LostSignalReplay.Result;
import com.microboxlabs.miot.symptoms.events.SymptomCaseData;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The lost-signal detector and the platform template on synthetic fleets, frames replayed in arrival order
 * ({@link LostSignalReplay}); see {@code evals/lost-signal/README.md}. Vehicles, senders and positions are made
 * up. Each vehicle first reports for two hours, so its profile is warm as in production.
 */
class LostSignalScenariosEvalTest {

    private static final int WARM = 2 * 3600;
    private static final double LAT = -30.0;
    private static final double LON = -70.0;

    @Test
    void anAbruptCutAtSpeedOnAnOnTimeSenderOpensWithinTwoMinutes() {
        List<Frame> frames = LostSignalReplay.steady("CUT", "ON-TIME", 0, WARM, 30, 3, 80, true, LAT, LON);

        Result r = LostSignalReplay.run(frames, WARM + 3600);

        Change opened = r.of("CUT").get(0);
        assertEquals(Kind.OPENED, opened.kind());
        int afterLastArrival = opened.at() - (WARM + 3);
        assertTrue(afterLastArrival >= 60 && afterLastArrival <= 120, afterLastArrival + " s");
        assertEquals(2, r.of("CUT").get(1).level(), "L: 30 min without signal");
        assertNear(WARM + 1800 + 30, r.of("CUT").get(1).at(), 30, "L, at the next minute's recheck");
    }

    @Test
    void aSlowReporterOpensNothing() {
        // Its profile needs 20 gaps: here they come off a trip, as from the days before (profiles live a week).
        List<Frame> frames = new ArrayList<>(LostSignalReplay.steady("SLOW", "ON-TIME", 0, 4 * 3600, 600, 3, 80,
                true, LAT, LON).stream().map(LostSignalReplay::offTrip).toList());
        frames.addAll(LostSignalReplay.steady("SLOW", "ON-TIME", 4 * 3600 + 600, 14 * 3600, 600, 3, 80, true, LAT,
                LON));

        assertEquals(0, LostSignalReplay.run(frames, 14 * 3600 + 300).opened());
    }

    @Test
    void anEngineOffStopOpensNothing() {
        List<Frame> frames = new ArrayList<>(LostSignalReplay.steady("PARKED", "ON-TIME", 0, WARM, 30, 3, 70, true,
                LAT, LON));
        // Engine off at a stop: the device reports every 20 to 40 min.
        int t = WARM + 30;
        int[] gaps = { 1200, 2400, 1800, 2400, 1500, 2100 };
        for (int gap : gaps) {
            frames.add(new Frame("PARKED", "ON-TIME", t, t + 3, 0, false, LAT, LON, true));
            t += gap;
        }

        assertEquals(0, LostSignalReplay.run(frames, t).opened());
    }

    @Test
    void aBackfillInAShadowCellStaysAtTheLowLevelAndIsReported() {
        double shadowLat = LAT + 0.52;
        double shadowLon = LON + 0.52;
        List<Frame> frames = new ArrayList<>();
        // Other vehicles of two senders cross the cell: GPS keeps fixing, the cellular network does not.
        for (int v = 0; v < 6; v++) {
            String sender = v % 2 == 0 ? "ON-TIME" : "OTHER";
            frames.addAll(LostSignalReplay.steady("PASS" + v, sender, 0, WARM, 30, 3, 80, true, LAT, LON));
            for (int t = WARM - 1800 + v * 60; t <= WARM - 900; t += 30) {
                frames.add(new Frame("PASS" + v, sender, t, WARM - 600 + v, 80, true, shadowLat, shadowLon, true));
            }
        }
        frames.addAll(LostSignalReplay.steady("SHADOW", "ON-TIME", 0, WARM, 30, 3, 80, true, LAT, LON));
        int cut = WARM + 30;
        frames.add(new Frame("SHADOW", "ON-TIME", cut, cut + 3, 80, true, shadowLat, shadowLon, true));
        // 40 min later the network is back and the buffer arrives in order, then live frames.
        int back = cut + 2400;
        for (int t = cut + 30; t <= back; t += 30) {
            frames.add(new Frame("SHADOW", "ON-TIME", t, back + 1, 80, true, shadowLat, shadowLon, true));
        }
        frames.addAll(LostSignalReplay.steady("SHADOW", "ON-TIME", back + 30, back + 600, 30, 3, 80, true, LAT,
                LON));

        Result r = LostSignalReplay.run(frames, back + 700);

        assertEquals(1, r.topLevel("SHADOW"), "past L, but the cell is low coverage");
        SymptomCaseData returned = r.returns().get(0);
        assertEquals("SHADOW", returned.assetId());
        assertTrue(returned.backfill());
        assertTrue(r.of("SHADOW").stream().noneMatch(c -> c.kind() == Kind.CLOSED), "the operator closes it");
    }

    @Test
    void aBatchForwardingSenderDoesNotFloodCases() {
        List<Frame> frames = new ArrayList<>();
        for (int v = 0; v < 5; v++) {
            // Its platform forwards every 20 min whatever it has collected.
            for (int t = v * 7; t <= 4 * 3600; t += 30) {
                int arrives = (t / 1200 + 1) * 1200 + v;
                frames.add(new Frame("BATCH" + v, "BATCHER", t, arrives, 80, true, LAT, LON, true));
            }
        }

        Result r = LostSignalReplay.run(frames, 4 * 3600);

        assertEquals(0, r.opened(), r.changes().toString());
    }

    @Test
    void aGroupOutageOfOneSenderDoesNotEscalate() {
        List<Frame> frames = new ArrayList<>();
        for (int v = 0; v < 5; v++) {
            frames.addAll(LostSignalReplay.steady("GROUP" + v, "PROVIDER", v, WARM + v, 30, 3, 80, true,
                    LAT + v * 0.3, LON));
        }

        Result r = LostSignalReplay.run(frames, WARM + 2700);

        assertEquals(5, r.opened());
        for (int v = 0; v < 5; v++) {
            assertEquals(1, r.topLevel("GROUP" + v), "45 min, past L, but the whole sender is down");
        }
    }

    @Test
    void aLateOlderFrameDoesNotResetTheSilence() {
        List<Frame> frames = new ArrayList<>(LostSignalReplay.steady("LATE", "ON-TIME", 0, WARM, 30, 3, 80, true,
                LAT, LON));
        // 20 min into the silence, a frame from before it arrives.
        frames.add(new Frame("LATE", "ON-TIME", WARM - 600, WARM + 1200, 80, true, LAT, LON, true));

        Result r = LostSignalReplay.run(frames, WARM + 1900);

        assertEquals(List.of(Kind.OPENED, Kind.LEVEL_CHANGED), r.of("LATE").stream().map(Change::kind).toList());
        assertNear(WARM + 1800 + 30, r.of("LATE").get(1).at(), 30, "L counts from the newest frame");
        assertFalse(r.returns().stream().anyMatch(d -> d.assetId().equals("LATE")));
    }

    private static void assertNear(int expected, int actual, int tolerance, String message) {
        assertTrue(Math.abs(expected - actual) <= tolerance, message + ": expected " + expected + " ± " + tolerance
                + ", was " + actual);
    }
}

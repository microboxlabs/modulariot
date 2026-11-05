package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.CellDay;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.SenderDay;
import com.microboxlabs.miot.symptoms.lostsignal.ShadowMap.Level;
import com.microboxlabs.miot.symptoms.lostsignal.ShadowMap.Source;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ShadowMapTest {

    private static final LocalDate TODAY = LocalDate.parse("2026-02-01");
    private static final LocalDate YESTERDAY = TODAY.minusDays(1);
    private static final String CELL = "20:40";
    private static final String OTHER = "21:40";
    private final CoverageSettings settings = CoverageSettings.defaults();

    private final List<CellDay> cells = new ArrayList<>();
    private final List<SenderDay> senders = new ArrayList<>();

    /** A sender-day with frames in two cells: {@code CELL} at the given share, {@code OTHER} on time. */
    private void day(String sender, LocalDate day, int frames, double share) {
        long delayed = Math.round(frames * share);
        cells.add(new CellDay(sender, CELL, day, frames, delayed, 0));
        cells.add(new CellDay(sender, OTHER, day, frames * 4L, 0, 0));
        senders.add(new SenderDay(sender, day, frames * 5L, delayed, 0, 5.0, 30.0, false));
    }

    private ShadowMap map() {
        return ShadowMap.build(cells, senders, TODAY, settings);
    }

    @Test
    void aSenderWithEnoughFramesDecidesAlone() {
        day("s", YESTERDAY, 100, 0.5);

        Level l = map().level("s", CELL);
        assertTrue(l.shadow());
        assertEquals(Source.SENDER, l.source());
        assertEquals(0.5, l.share(), 0.001);
        assertFalse(map().level("s", OTHER).shadow());
    }

    @Test
    void aSenderDelayedEverywhereIsNotShadowInACell() {
        cells.add(new CellDay("s", CELL, YESTERDAY, 100, 50, 0));
        senders.add(new SenderDay("s", YESTERDAY, 100, 40, 0, 5.0, 30.0, false));

        Level l = map().level("s", CELL);
        assertFalse(l.shadow(), "0.5 is under 2 x the sender's 0.4");
        assertEquals(Source.SENDER, l.source());
    }

    @Test
    void missingFramesCountInTheShare() {
        cells.add(new CellDay("s", CELL, YESTERDAY, 30, 0, 20));
        senders.add(new SenderDay("s", YESTERDAY, 1000, 0, 20, 5.0, 30.0, false));

        Level l = map().level("s", CELL);
        assertEquals(0.4, l.share(), 0.001, "20 missing of 50");
        assertTrue(l.shadow());
    }

    @Test
    void aSenderWithoutFramesInACellTakesTheConsensusOfTwoOthers() {
        day("a", YESTERDAY, 100, 0.6);
        day("b", YESTERDAY, 100, 0.5);

        Level l = map().level("new", CELL);
        assertTrue(l.shadow());
        assertEquals(Source.CONSENSUS, l.source());
        assertEquals(0.55, l.share(), 0.001);
    }

    @Test
    void oneOtherSenderIsNotAConsensus() {
        day("a", YESTERDAY, 100, 0.6);

        assertEquals(Level.NONE, map().level("new", CELL));
        assertNull(map().level("new", "99:99").share());
    }

    @Test
    void twoOthersThatDisagreeAreNotShadow() {
        day("a", YESTERDAY, 100, 0.6);
        day("b", YESTERDAY, 100, 0.0);

        Level l = map().level("new", CELL);
        assertFalse(l.shadow());
        assertEquals(Source.CONSENSUS, l.source());
    }

    @Test
    void theBiggestSenderDoesNotDecideForAnotherWithItsOwnFrames() {
        day("big", YESTERDAY, 10_000, 0.6);
        day("big2", YESTERDAY, 10_000, 0.6);
        day("s", YESTERDAY, 100, 0.0);

        assertFalse(map().level("s", CELL).shadow());
        assertEquals(Source.SENDER, map().level("s", CELL).source());
    }

    @Test
    void tooFewFramesDoNotDecide() {
        day("s", YESTERDAY, 10, 1.0);

        assertEquals(Level.NONE, map().level("s", CELL));
    }

    @Test
    void anAnomalousDayIsDropped() {
        for (int age = 2; age <= 12; age++) {
            day("s", TODAY.minusDays(age), 100, 0.0);
        }
        // One bad day: the sender's frames arrive late everywhere.
        cells.add(new CellDay("s", CELL, YESTERDAY, 2000, 1200, 0));
        senders.add(new SenderDay("s", YESTERDAY, 2000, 1200, 0, 5.0, 30.0, false));

        List<SenderDay> flagged = ShadowMap.anomalous(senders, TODAY, settings);
        assertTrue(flagged.get(flagged.size() - 1).anomalous());
        assertEquals(1, flagged.stream().filter(SenderDay::anomalous).count());
        Level l = map().level("s", CELL);
        assertFalse(l.shadow());
        assertEquals(0, l.share(), 0.001);
    }

    @Test
    void aSenderAlwaysDelayedHasNoAnomalousDays() {
        for (int age = 1; age <= 5; age++) {
            senders.add(new SenderDay("s", TODAY.minusDays(age), 100, 60, 0, 5.0, 30.0, false));
        }

        assertTrue(ShadowMap.anomalous(senders, TODAY, settings).stream().noneMatch(SenderDay::anomalous));
    }

    @Test
    void daysFadeWithAWeekHalfLifeAndTheWindowEndsAtThirtyDays() {
        assertEquals(1.0 / Math.pow(2, 1 / 7.0), ShadowMap.weight(YESTERDAY, TODAY, settings), 1e-9);
        assertEquals(0.5, ShadowMap.weight(TODAY.minusDays(7), TODAY, settings), 1e-9);
        assertNull(ShadowMap.weight(TODAY, TODAY, settings), "today is not complete");
        assertNull(ShadowMap.weight(TODAY.minusDays(31), TODAY, settings));

        cells.add(new CellDay("s", CELL, TODAY.minusDays(28), 30, 30, 0));
        senders.add(new SenderDay("s", TODAY.minusDays(28), 1000, 30, 0, 5.0, 30.0, false));
        assertEquals(Level.NONE, map().level("s", CELL), "30 frames four weeks old weigh under 2");
    }
}

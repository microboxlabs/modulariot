package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.CellDay;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.Medians;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.SenderDay;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CoverageDayTest {

    static final LocalDate DAY = LocalDate.parse("2026-01-10");
    private static final long T0 = DAY.atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli();
    private static final double LAT = 1.01;
    private static final double LON = 2.01;
    private static final String CELL = CoverageMap.cell(LAT, LON);
    private final CoverageSettings settings = CoverageSettings.defaults();

    private static long at(double minutes) {
        return T0 + Math.round(minutes * 60_000);
    }

    private static CellDay only(List<CellDay> cells, String sender, String cell) {
        return cells.stream().filter(c -> c.sender().equals(sender) && c.cell().equals(cell)).findFirst()
                .orElseThrow();
    }

    @Test
    void aSenderThatBatchesEveryElevenMinutesIsNotDelayed() {
        // Delays spread over [0, 11 min]: median 5.5 min, threshold 16.5 min.
        CoverageDay day = new CoverageDay(DAY, settings, Map.of("batch", new Medians(330.0, 30.0),
                "live", new Medians(5.0, 30.0)));
        for (int i = 0; i < 40; i++) {
            double delay = 660.0 * (i % 23) / 22;
            day.frame("V1", "batch", at(i * 0.5), delay, LAT, LON);
            day.frame("V2", "live", at(i * 0.5), 660, LAT, LON);
        }

        assertEquals(0, only(day.cells(), "batch", CELL).delayed());
        assertEquals(40, only(day.cells(), "live", CELL).delayed(), "11 min is late for a sender that is on time");
    }

    @Test
    void theFloorHoldsForASenderOnTime() {
        CoverageDay day = new CoverageDay(DAY, settings, Map.of("s", new Medians(2.0, 30.0)));
        day.frame("V1", "s", at(0), 590, LAT, LON);
        day.frame("V1", "s", at(0.5), 610, LAT, LON);

        assertEquals(1, only(day.cells(), "s", CELL).delayed());
    }

    @Test
    void aGapOfAMovingVehicleAddsMissingFramesToTheCrossedCells() {
        CoverageDay day = new CoverageDay(DAY, settings, Map.of("s", new Medians(5.0, 60.0)));
        day.frame("V1", "s", at(0), 5, LAT, LON);
        day.frame("V1", "s", at(20), 5, LAT, LON + 0.2); // about 22 km in 20 min

        List<CellDay> cells = day.cells();
        double missing = cells.stream().mapToDouble(CellDay::missing).sum();
        assertEquals(19, missing, 0.01, "20 min at one frame a minute: 19 never arrived");
        assertTrue(cells.size() >= 4, "the line crosses 0.2 degrees of 0.05 degree cells");
        assertEquals(cells.get(0).missing(), cells.get(cells.size() - 1).missing(), 0.01, "spread evenly");
        SenderDay s = day.senders().get(0);
        assertEquals(19, s.missing(), 0.01);
        assertEquals(2, s.frames());
    }

    @Test
    void aParkedVehiclesGapAddsNothing() {
        CoverageDay day = new CoverageDay(DAY, settings, Map.of("s", new Medians(5.0, 60.0)));
        day.frame("V1", "s", at(0), 5, LAT, LON);
        day.frame("V1", "s", at(120), 5, LAT + 0.001, LON);

        assertEquals(0, only(day.cells(), "s", CELL).missing());
    }

    @Test
    void aJumpFasterThanAVehicleIsNotAGap() {
        CoverageDay day = new CoverageDay(DAY, settings, Map.of("s", new Medians(5.0, 60.0)));
        day.frame("V1", "s", at(0), 5, LAT, LON);
        day.frame("V1", "s", at(20), 5, LAT, LON + 5);

        assertEquals(0, day.cells().stream().mapToDouble(CellDay::missing).sum());
    }

    @Test
    void aSilenceWithinTheThresholdIsNotAGap() {
        CoverageDay day = new CoverageDay(DAY, settings, Map.of("s", new Medians(5.0, 60.0)));
        day.frame("V1", "s", at(0), 5, LAT, LON);
        day.frame("V1", "s", at(9), 5, LAT, LON + 0.1);

        assertEquals(0, day.cells().stream().mapToDouble(CellDay::missing).sum(), "under the 10 min floor");
    }

    @Test
    void framesOfTwoSendersOnOneAssetAreNotOneGap() {
        CoverageDay day = new CoverageDay(DAY, settings, Map.of("a", new Medians(5.0, 60.0),
                "b", new Medians(5.0, 60.0)));
        day.frame("V1", "a", at(0), 5, LAT, LON);
        day.frame("V1", "b", at(30), 5, LAT, LON + 0.2);

        assertEquals(0, day.cells().stream().mapToDouble(CellDay::missing).sum());
    }

    @Test
    void aGapAcrossMidnightStartsAtTheFrameBeforeTheDay() {
        CoverageDay day = new CoverageDay(DAY, settings, Map.of("s", new Medians(5.0, 60.0)));
        day.before("V1", "s", at(-10), LAT, LON);
        day.frame("V1", "s", at(10), 5, LAT, LON + 0.2);

        assertEquals(19, day.cells().stream().mapToDouble(CellDay::missing).sum(), 0.01);
    }

    @Test
    void aSenderWithoutAnIntervalMedianHasNoGaps() {
        CoverageDay day = new CoverageDay(DAY, settings, Map.of());
        day.frame("V1", "s", at(0), 5, LAT, LON);
        day.frame("V1", "s", at(30), 5, LAT, LON + 0.2);

        assertEquals(0, day.cells().stream().mapToDouble(CellDay::missing).sum());
        assertFalse(day.cells().isEmpty());
    }

    @Test
    void theLineCrossesEachCellOnce() {
        assertEquals(List.of(CoverageMap.cell(1.01, 2.01), CoverageMap.cell(1.01, 2.06), CoverageMap.cell(1.01, 2.11)),
                List.copyOf(CoverageDay.crossed(1.01, 2.01, 1.01, 2.11)));
        assertEquals(1, CoverageDay.crossed(1.01, 2.01, 1.01, 2.01).size());
        assertEquals(11.1, CoverageDay.km(0, 0, 0.1, 0), 0.1);
    }

    @Test
    void theMedianInterpolatesAsPercentileCont() {
        SecondsHistogram h = new SecondsHistogram();
        h.add(10, 1);
        h.add(20, 1);
        assertEquals(15, h.median());
        h.add(30, 2);
        assertEquals(25, h.median());
        assertEquals(null, new SecondsHistogram().median());
    }
}

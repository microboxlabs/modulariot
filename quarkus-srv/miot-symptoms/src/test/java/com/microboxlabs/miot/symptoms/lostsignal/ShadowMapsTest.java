package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.CellDay;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.SenderDay;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class ShadowMapsTest {

    @Test
    void aReloadBuildsTheMapFromTheWindowsRows() {
        LocalDate yesterday = LocalDate.parse("2026-03-01");
        CoverageJobTest.Store store = new CoverageJobTest.Store();
        store.replace(yesterday, List.of(new CellDay("s", "20:40", yesterday, 100, 60, 0)),
                List.of(new SenderDay("s", yesterday, 1000, 60, 0, 5.0, 30.0, false)), 1000);
        ShadowMaps maps = new ShadowMaps(store, CoverageSettings.defaults(),
                Clock.fixed(Instant.parse("2026-03-02T10:00:00Z"), ZoneOffset.UTC));

        assertEquals(ShadowMap.Level.NONE, maps.get().level("s", "20:40"), "empty until the first reload");
        assertEquals(1, maps.reload());
        assertTrue(maps.get().level("s", "20:40").shadow());
    }
}

package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.CellDay;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.SenderDay;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
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

    @Test
    void aFailedReloadKeepsThePreviousMapEvenAfterTheCellReadSucceeds() {
        LocalDate yesterday = LocalDate.parse("2026-03-01");
        AtomicBoolean fail = new AtomicBoolean();
        CoverageJobTest.Store store = new CoverageJobTest.Store() {
            @Override
            public List<SenderDay> senders(LocalDate from) {
                if (fail.get()) {
                    throw new IllegalStateException("store unavailable");
                }
                return super.senders(from);
            }
        };
        store.replace(yesterday, List.of(new CellDay("s", "20:40", yesterday, 100, 60, 0)),
                List.of(new SenderDay("s", yesterday, 1000, 60, 0, 5.0, 30.0, false)), 1000);
        ShadowMaps maps = new ShadowMaps(store, CoverageSettings.defaults(),
                Clock.fixed(Instant.parse("2026-03-02T10:00:00Z"), ZoneOffset.UTC));
        maps.reload();
        ShadowMap previous = maps.get();

        fail.set(true);
        assertThrows(IllegalStateException.class, maps::reload);
        assertSame(previous, maps.get());
        assertTrue(maps.get().level("s", "20:40").shadow());
    }

    @Test
    void noStoreKeepsTheMapEmpty() {
        ShadowMaps maps = new ShadowMaps(null, CoverageSettings.defaults(), Clock.systemUTC());

        assertEquals(0, maps.reload());
        assertEquals(ShadowMap.Level.NONE, maps.get().level("s", "20:40"));
    }
}

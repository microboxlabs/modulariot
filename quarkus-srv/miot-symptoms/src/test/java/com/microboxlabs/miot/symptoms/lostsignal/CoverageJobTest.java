package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.CellDay;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.SenderDay;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;

class CoverageJobTest {

    private static final Instant NOW = Instant.parse("2026-03-01T03:00:00Z");
    private static final LocalDate TODAY = LocalDate.parse("2026-03-01");

    /** A vehicle reporting once a minute, every frame two seconds late, moving east. */
    static class Frames implements GpsFrames {
        final List<Instant> reads = new ArrayList<>();

        @Override
        public List<Count> delays(Instant from, Instant to) {
            return List.of(new Count("s", 2, 60));
        }

        @Override
        public List<Count> intervals(Instant from, Instant to) {
            return List.of(new Count("s", 60, 59));
        }

        @Override
        public List<GpsRow> frames(Instant from, Instant to) {
            reads.add(from);
            List<GpsRow> out = new ArrayList<>();
            for (Instant t = from; t.isBefore(to); t = t.plusSeconds(60)) {
                double minutes = (t.getEpochSecond() % 86_400) / 60.0;
                out.add(new GpsRow("V1", "s", t.toEpochMilli(), 2, 1.01, 2.01 + minutes * 0.0001));
            }
            return out;
        }
    }

    static final class Store implements CoverageStore {
        final Map<LocalDate, List<CellDay>> cells = new HashMap<>();
        final Map<LocalDate, List<SenderDay>> senders = new HashMap<>();
        final Set<LocalDate> done = new HashSet<>();
        final List<LocalDate> order = new ArrayList<>();

        @Override
        public Set<LocalDate> done(LocalDate from) {
            Set<LocalDate> out = new HashSet<>();
            done.stream().filter(d -> !d.isBefore(from)).forEach(out::add);
            return out;
        }

        @Override
        public void replace(LocalDate day, List<CellDay> c, List<SenderDay> s, long frames) {
            cells.put(day, c);
            senders.put(day, s);
            done.add(day);
            order.add(day);
        }

        @Override
        public List<CellDay> cells(LocalDate from) {
            return cells.entrySet().stream().filter(e -> !e.getKey().isBefore(from))
                    .flatMap(e -> e.getValue().stream()).toList();
        }

        @Override
        public List<SenderDay> senders(LocalDate from) {
            return senders.entrySet().stream().filter(e -> !e.getKey().isBefore(from))
                    .flatMap(e -> e.getValue().stream()).toList();
        }

        @Override
        public void flag(List<SenderDay> flagged) {
            for (SenderDay f : flagged) {
                senders.computeIfPresent(f.day(), (d, list) -> list.stream()
                        .map(s -> s.sender().equals(f.sender()) ? f : s).toList());
            }
        }

        @Override
        public void purge(LocalDate before) {
            cells.keySet().removeIf(d -> d.isBefore(before));
            senders.keySet().removeIf(d -> d.isBefore(before));
            done.removeIf(d -> d.isBefore(before));
        }
    }

    private final Frames gps = new Frames();
    private final Store store = new Store();

    private CoverageJob job(Instant now, CoverageJob.Lease lease) {
        return new CoverageJob(new CoverageJob.JobSettings(true, Duration.ofHours(2)),
                gps, store, CoverageSettings.defaults(), lease,
                new SimpleMeterRegistry(), java.time.Clock.fixed(now, ZoneOffset.UTC));
    }

    @Test
    void anEmptyStartFillsTheLastThirtyDaysNewestFirst() {
        assertEquals(30, job(NOW, ttl -> true).run());

        assertEquals(TODAY.minusDays(1), store.order.get(0));
        assertEquals(TODAY.minusDays(30), store.order.get(29));
        SenderDay s = store.senders.get(TODAY.minusDays(1)).get(0);
        assertEquals(1440, s.frames());
        assertEquals(2.0, s.medianDelayS());
        assertEquals(60.0, s.medianIntervalS());
        assertEquals(0, s.delayed());
        assertEquals(0, job(NOW, ttl -> true).run(), "every day is done");
    }

    @Test
    void eachDayIsReadAnHourAtATimeWithTheHourBefore() {
        job(NOW, ttl -> true).run();

        Instant start = TODAY.minusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        for (int h = -1; h < 24; h++) {
            assertEquals(start.plus(Duration.ofHours(h)), gps.reads.get(h + 1));
        }
    }

    @Test
    void yesterdayWaitsForLateFrames() {
        job(Instant.parse("2026-03-01T01:00:00Z"), ttl -> true).run();

        assertFalse(store.done.contains(TODAY.minusDays(1)));
        assertTrue(store.done.contains(TODAY.minusDays(2)));
    }

    @Test
    void anotherReplicasLeaseStopsTheRun() {
        AtomicBoolean held = new AtomicBoolean(false);

        assertThrows(CoverageJob.LeaseLost.class, () -> job(NOW, ttl -> held.get()).run());
        assertTrue(store.done.isEmpty());
    }

    @Test
    void daysBeforeTheWindowAreDeleted() {
        store.replace(TODAY.minusDays(40), List.of(), List.of(), 0);

        job(NOW, ttl -> true).run();

        assertFalse(store.done.contains(TODAY.minusDays(40)));
    }

    @Test
    void aFailedDayDoesNotBlockOlderDaysOrMaintenanceAndIsRetried() {
        LocalDate failed = TODAY.minusDays(1);
        Instant failedStart = failed.atStartOfDay(ZoneOffset.UTC).toInstant();
        AtomicBoolean failing = new AtomicBoolean(true);
        GpsFrames unreliable = new Frames() {
            @Override
            public List<Count> delays(Instant from, Instant to) {
                if (failing.get() && from.equals(failedStart)) {
                    throw new IllegalStateException("day unavailable");
                }
                return super.delays(from, to);
            }
        };
        SimpleMeterRegistry meters = new SimpleMeterRegistry();
        CoverageJob job = new CoverageJob(new CoverageJob.JobSettings(true, Duration.ofHours(2)),
                unreliable, store, CoverageSettings.defaults(), ttl -> true, meters,
                java.time.Clock.fixed(NOW, ZoneOffset.UTC));
        store.replace(TODAY.minusDays(40), List.of(), List.of(), 0);
        store.replace(TODAY.minusDays(3), List.of(),
                List.of(new SenderDay("s", TODAY.minusDays(3), 100, 0, 0, 2.0, 60.0, true)), 100);

        assertEquals(28, job.run());
        assertFalse(store.done.contains(failed));
        assertTrue(store.done.contains(TODAY.minusDays(2)));
        assertFalse(store.done.contains(TODAY.minusDays(40)));
        assertFalse(store.senders.get(TODAY.minusDays(3)).get(0).anomalous());
        assertEquals(1, meters.get("miot.symptoms.lost_signal.coverage_failed").counter().count());

        failing.set(false);
        assertEquals(1, job.run());
        assertTrue(store.done.contains(failed));
    }

    @Test
    void losingTheLeaseDuringADayStopsOlderDays() {
        java.util.concurrent.atomic.AtomicInteger renewals = new java.util.concurrent.atomic.AtomicInteger();

        assertThrows(CoverageJob.LeaseLost.class,
                () -> job(NOW, ttl -> renewals.incrementAndGet() < 4).run());
        assertTrue(store.done.isEmpty());
    }

    @Test
    void aDisabledJobDoesNotAccessItsDependencies() {
        new CoverageJob(new CoverageJob.JobSettings(false, Duration.ofHours(2)),
                null, null, CoverageSettings.defaults(), null, null, null).scheduled();
    }
}

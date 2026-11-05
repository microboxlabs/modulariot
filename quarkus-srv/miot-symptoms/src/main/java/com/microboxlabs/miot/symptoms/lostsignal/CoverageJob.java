package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.core.gps.GpsDatabase;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorRedis;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.Medians;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.SenderDay;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.eclipse.microprofile.config.ConfigProvider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Builds the shadow map's day rows from {@code asset_data}, all vehicles of all clients. Each run fills every day of
 * the window that is not done yet, newest first; yesterday is ready {@code settle} after midnight UTC, so late
 * frames arrive first. A day is read one hour at a time, twice: first the senders' delay and interval counts, for
 * their medians, then the frames ({@link CoverageDay}). Each frame is counted as it is read and then dropped, so
 * the job's memory grows with the day's assets, senders and cells, not with its frames. The day's rows are replaced
 * in one transaction. Then the days before the window are deleted and the anomalous sender-days flagged
 * ({@link ShadowMap#anomalous}).
 *
 * <p>One replica runs it: the one holding the Redis lease {@value #LEASE_KEY}, renewed every hour read. Without
 * Redis every replica runs it; the writes are idempotent. On where the lost-signal detector is
 * ({@code miot.symptoms.evaluator.enabled}), the GPS database is configured and
 * {@code miot.symptoms.lost-signal.coverage.job-enabled} is true.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class CoverageJob {

    private static final Logger LOG = Logger.getLogger(CoverageJob.class);
    static final String LEASE_KEY = "symptoms:coverage:lease";
    private static final Duration LEASE_TTL = Duration.ofMinutes(10);
    private static final Duration HOUR = Duration.ofHours(1);

    /** Takes or renews the job's lease. */
    @FunctionalInterface
    public interface Lease {
        boolean hold(Duration ttl);
    }

    /** Whether the job runs and how long it waits for a day's late frames. */
    public record JobSettings(boolean enabled, Duration settle) {
    }

    static final class LeaseLost extends RuntimeException {
        LeaseLost() {
            super("coverage lease lost", null, false, false);
        }
    }

    private final boolean enabled;
    private final GpsFrames gps;
    private final CoverageStore store;
    private final CoverageSettings settings;
    private final Duration settle;
    private final Lease lease;
    private final MeterRegistry meters;
    private final Clock clock;

    @Inject
    CoverageJob(@ConfigProperty(name = "miot.symptoms.evaluator.enabled", defaultValue = "false") boolean detector,
            @ConfigProperty(name = "miot.symptoms.lost-signal.coverage.job-enabled", defaultValue = "true") boolean job,
            @ConfigProperty(name = "miot.symptoms.lost-signal.coverage.settle", defaultValue = "PT2H") Duration settle,
            GpsDatabase gpsDb, Instance<Pool> pool, EvaluatorRedis redis, MeterRegistry meters) {
        this(new JobSettings(detector && job && gpsDb.configured(), settle),
                gpsDb.configured() ? new PgGpsFrames(gpsDb::readPool) : null,
                new PgCoverageStore(pool::get), CoverageSettings.from(ConfigProvider.getConfig()),
                lease(redis), meters, Clock.systemUTC());
    }

    public CoverageJob(JobSettings job, GpsFrames gps, CoverageStore store, CoverageSettings settings,
            Lease lease, MeterRegistry meters, Clock clock) {
        this.enabled = job.enabled();
        this.gps = gps;
        this.store = store;
        this.settings = settings;
        this.settle = job.settle();
        this.lease = lease;
        this.meters = meters;
        this.clock = clock;
    }

    private static Lease lease(EvaluatorRedis redis) {
        String owner = UUID.randomUUID().toString();
        return redis.client().<Lease>map(c -> {
            RedisLossStore r = new RedisLossStore(c, Duration.ofDays(1));
            return ttl -> r.lease(LEASE_KEY, owner, ttl);
        }).orElse(ttl -> true);
    }

    /**
     * Every 10 minutes by default: a run with nothing to fill is a few small queries, and a replica that started while
     * the one it replaced still held the lease gets its turn soon instead of an hour later. The counters are what an
     * installation logging at ERROR can see.
     */
    @Scheduled(every = "${miot.symptoms.lost-signal.coverage.every:10m}", delayed = "2m",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduled() {
        if (!enabled) {
            return;
        }
        try {
            run();
        } catch (LeaseLost e) {
            meters.counter("miot.symptoms.lost_signal.coverage_lease_held").increment();
            LOG.info("Coverage job: another replica holds the lease");
        } catch (RuntimeException e) {
            // The day stays not done: the next run fills it.
            meters.counter("miot.symptoms.lost_signal.coverage_failed").increment();
            LOG.warnf("Coverage job: run failed (%s)", e.getClass().getSimpleName());
        }
    }

    /** One run; returns the days it filled. */
    public int run() {
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        LocalDate first = today.minusDays(settings.window());
        hold();
        Set<LocalDate> done = store.done(first);
        int filled = 0;
        for (int age = 1; age <= settings.window(); age++) {
            LocalDate day = today.minusDays(age);
            boolean ready = !now.isBefore(start(day.plusDays(1)).plus(settle));
            if (ready && !done.contains(day)) {
                try {
                    fill(day);
                    filled++;
                } catch (LeaseLost e) {
                    throw e;
                } catch (RuntimeException e) {
                    meters.counter("miot.symptoms.lost_signal.coverage_failed").increment();
                    LOG.warnf("Coverage job: day %s failed (%s)", day, e.getClass().getSimpleName());
                }
            }
        }
        store.purge(first);
        List<SenderDay> senders = store.senders(first);
        List<SenderDay> changed = new ArrayList<>();
        List<SenderDay> flagged = ShadowMap.anomalous(senders, today, settings);
        for (int i = 0; i < senders.size(); i++) {
            if (senders.get(i).anomalous() != flagged.get(i).anomalous()) {
                changed.add(flagged.get(i));
            }
        }
        store.flag(changed);
        return filled;
    }

    /** Reads one UTC day of {@code asset_data} and replaces its rows. */
    void fill(LocalDate day) {
        long began = System.nanoTime();
        Instant start = start(day);
        Map<String, SecondsHistogram> delays = new HashMap<>();
        Map<String, SecondsHistogram> intervals = new HashMap<>();
        for (int h = 0; h < 24; h++) {
            hold();
            Instant from = start.plus(HOUR.multipliedBy(h));
            gps.delays(from, from.plus(HOUR)).forEach(c -> delays.computeIfAbsent(c.sender(),
                    k -> new SecondsHistogram()).add(c.seconds(), c.n()));
            gps.intervals(from, from.plus(HOUR)).forEach(c -> intervals.computeIfAbsent(c.sender(),
                    k -> new SecondsHistogram()).add(c.seconds(), c.n()));
        }
        Map<String, Medians> medians = new HashMap<>();
        delays.forEach((s, h) -> medians.put(s, new Medians(h.median(), null)));
        intervals.forEach((s, h) -> medians.merge(s, new Medians(null, h.median()),
                (a, b) -> new Medians(a.delayS(), b.intervalS())));
        CoverageDay rows = new CoverageDay(day, settings, medians);
        gps.frames(start.minus(HOUR), start, r -> rows.before(r.assetId(), r.sender(), r.atMs(), r.lat(), r.lon()));
        long frames = 0;
        for (int h = 0; h < 24; h++) {
            hold();
            Instant from = start.plus(HOUR.multipliedBy(h));
            frames += gps.frames(from, from.plus(HOUR),
                    r -> rows.frame(r.assetId(), r.sender(), r.atMs(), r.delayS(), r.lat(), r.lon()));
        }
        store.replace(day, rows.cells(), rows.senders(), frames);
        meters.counter("miot.symptoms.lost_signal.coverage_days").increment();
        meters.counter("miot.symptoms.lost_signal.coverage_days_filled").increment();
        LOG.infof("Coverage job: day %s done, %d frames, %d senders, %d s", day, frames, rows.senders().size(),
                Duration.ofNanos(System.nanoTime() - began).toSeconds());
    }

    private void hold() {
        if (!lease.hold(LEASE_TTL)) {
            throw new LeaseLost();
        }
    }

    private static Instant start(LocalDate day) {
        return day.atStartOfDay(ZoneOffset.UTC).toInstant();
    }
}

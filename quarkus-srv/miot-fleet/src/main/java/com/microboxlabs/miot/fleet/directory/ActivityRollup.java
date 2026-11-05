package com.microboxlabs.miot.fleet.directory;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import org.jboss.logging.Logger;

/**
 * Computes hourly activity from GPS signals. Each run recomputes the last {@code RECENT_HOURS} hours, so late
 * signals are counted. It then spends up to {@code backfillPerRun} hours first on hours missed while it was not
 * running, then on older hours until {@code history} is covered.
 * Writes are idempotent: two replicas running at once only repeat work.
 */
public class ActivityRollup {

    static final String BACKFILL_CURSOR = "backfill";
    static final String LATEST_CURSOR = "latest";
    static final int RECENT_HOURS = 3;

    private static final Logger LOG = Logger.getLogger(ActivityRollup.class);

    private final FleetData data;
    private final ActivityStore store;
    private final Clock clock;
    private final ZoneId zone;
    private final Duration history;
    private final int backfillPerRun;

    public ActivityRollup(FleetData data, ActivityStore store, Clock clock, ZoneId zone, Duration history,
            int backfillPerRun) {
        this.data = data;
        this.store = store;
        this.clock = clock;
        this.zone = zone;
        this.history = history;
        this.backfillPerRun = backfillPerRun;
    }

    public void run() {
        Instant current = clock.instant().truncatedTo(ChronoUnit.HOURS);
        Instant recentStart = current.minus(RECENT_HOURS - 1L, ChronoUnit.HOURS);
        for (Instant hour = recentStart; !hour.isAfter(current); hour = hour.plus(1, ChronoUnit.HOURS)) {
            compute(hour);
        }
        Instant oldest = current.minus(history);
        int budget = backfillPerRun;
        Instant latest = store.cursor(LATEST_CURSOR).orElse(current);
        Instant gap = latest.isBefore(oldest) ? oldest : latest.plus(1, ChronoUnit.HOURS);
        for (; gap.isBefore(recentStart) && budget > 0; gap = gap.plus(1, ChronoUnit.HOURS), budget--) {
            compute(gap);
            store.cursor(LATEST_CURSOR, gap);
        }
        if (!gap.isBefore(recentStart)) {
            store.cursor(LATEST_CURSOR, current);
        }
        Instant done = store.cursor(BACKFILL_CURSOR).orElse(recentStart);
        for (int i = 0; i < budget && done.isAfter(oldest); i++) {
            done = done.minus(1, ChronoUnit.HOURS);
            compute(done);
            store.cursor(BACKFILL_CURSOR, done);
        }
        store.prune(oldest.minus(2, ChronoUnit.DAYS), LocalDate.ofInstant(current, zone).minusDays(400));
    }

    private void compute(Instant hour) {
        Instant end = hour.plus(1, ChronoUnit.HOURS);
        var hours = data.activity(hour, end);
        store.saveHours(hour, end, hours, zone);
        LOG.debugf("Fleet activity %s: %d assets", hour, hours.size());
    }
}

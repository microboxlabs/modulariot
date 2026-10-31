package com.microboxlabs.miot.symptoms.lostsignal;

import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.jboss.logging.Logger;

/**
 * One pass of the lost-signal ticker: in the replica that holds the lease, and only while ingest keeps up, takes
 * the vehicles whose deadline expired and checks each one ({@link DueCheck}). A check reschedules the vehicle, so
 * a lease that moves to another replica repeats nothing.
 */
public class LossTicker {

    private static final Logger LOG = Logger.getLogger(LossTicker.class);

    /** Checks one vehicle whose deadline expired. */
    @FunctionalInterface
    public interface DueCheck {
        void check(String assetId, Instant now);
    }

    private final LossStore store;
    private final DueCheck checks;
    private final IngestHealth ingest;
    private final String owner;
    private final Duration leaseTtl;
    private final int batch;
    private final MeterRegistry meters;
    private final Clock clock;

    public LossTicker(LossStore store, DueCheck checks, IngestHealth ingest, String owner, Duration leaseTtl,
            int batch, MeterRegistry meters, Clock clock) {
        this.store = store;
        this.checks = checks;
        this.ingest = ingest;
        this.owner = owner;
        this.leaseTtl = leaseTtl;
        this.batch = batch;
        this.meters = meters;
        this.clock = clock;
    }

    /** @return the vehicles checked */
    public int tick() {
        Instant now = clock.instant();
        if (!store.lease(owner, leaseTtl)) {
            return 0;
        }
        Optional<String> pause = ingest.pause(store.heartbeats(), now);
        if (pause.isPresent()) {
            meters.counter("miot.symptoms.lost_signal.paused", "reason", pause.get()).increment();
            return 0;
        }
        List<String> due = store.due(now, batch);
        int checked = 0;
        for (String assetId : due) {
            try {
                checks.check(assetId, now);
                checked++;
            } catch (RuntimeException e) {
                // Still due: the next pass takes it again.
                meters.counter("miot.symptoms.lost_signal.check_failed").increment();
                LOG.debugf("Lost-signal ticker: check failed (%s)", e.getClass().getSimpleName());
            }
        }
        return checked;
    }
}

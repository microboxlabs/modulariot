package com.microboxlabs.miot.places.service;

import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

/**
 * Copies to StreamHub what a write left pending: a sync that failed, or one written while nothing really copied.
 * Each run takes up to {@value #BATCH} places, the deleted ones first. Replicas may run it at once: every copy is
 * idempotent, so one place copied twice is no harm.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class PlaceSyncRetry {

    static final int BATCH = 200;
    private static final Logger LOG = Logger.getLogger(PlaceSyncRetry.class);

    private final PlaceService places;

    @Inject
    public PlaceSyncRetry(PlaceService places) {
        this.places = places;
    }

    @Scheduled(every = "${miot.places.sync.retry.every:5m}", delayed = "1m",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void retry() {
        try {
            int synced = places.retryPending(BATCH);
            if (synced > 0) {
                LOG.infof("places sync: %d pending places synced", synced);
            }
        } catch (RuntimeException e) {
            LOG.warnf(e, "places sync: the pending places could not be read; next run tries again");
        }
    }
}

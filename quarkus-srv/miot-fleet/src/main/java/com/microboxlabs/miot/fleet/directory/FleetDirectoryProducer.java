package com.microboxlabs.miot.fleet.directory;

import com.microboxlabs.miot.core.gps.GpsDatabase;
import com.microboxlabs.miot.core.vehicle.VehicleImages;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import org.jboss.logging.Logger;

/**
 * Wires the fleet directory from {@code miot.fleet.source}: {@code gps} reads the GPS database
 * ({@link GpsDatabase}) and keeps edits in the modulith database; {@code demo} serves
 * fixed data and keeps edits in memory; anything else answers 503.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class FleetDirectoryProducer {

    private static final Logger LOG = Logger.getLogger(FleetDirectoryProducer.class);

    private final Instance<Pool> modulithPool;
    private final GpsDatabase gps;
    private final VehicleImages images;
    private final String source;
    private final ZoneId zone;
    private final Duration cacheTtl;
    private final Duration history;
    private final int backfillPerRun;
    private final Clock clock = Clock.systemUTC();
    private Wiring wiring;

    FleetDirectoryProducer(Instance<Pool> modulithPool, GpsDatabase gps, VehicleImages images, FleetConfig config) {
        this.modulithPool = modulithPool;
        this.gps = gps;
        this.images = images;
        this.source = config.source();
        this.zone = ZoneId.of(config.zone());
        this.cacheTtl = config.cacheTtl();
        this.history = config.activity().history();
        this.backfillPerRun = config.activity().backfillPerRun();
    }

    /** Singleton: the service has no no-args constructor, so it cannot sit behind a client proxy. */
    @Produces
    @Singleton
    FleetDirectoryService service() {
        return wiring().service();
    }

    @Scheduled(every = "${miot.fleet.activity.every:15m}", delayed = "${miot.fleet.activity.delay:30s}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void rollUpActivity() {
        ActivityRollup rollup = wiring().rollup();
        if (rollup == null) {
            return;
        }
        try {
            rollup.run();
        } catch (RuntimeException e) {
            LOG.warnf(e, "Fleet activity rollup failed");
        }
    }

    /** The service and its rollup share the source and stores; whichever runs first builds them. */
    private record Wiring(FleetDirectoryService service, ActivityRollup rollup) {
    }

    private synchronized Wiring wiring() {
        if (wiring != null) {
            return wiring;
        }
        if ("demo".equals(source)) {
            LOG.info("Fleet directory: demo data, edits in memory");
            FleetData data = new DemoFleetData(clock::instant);
            ActivityStore activity = new InMemoryActivityStore();
            wiring = new Wiring(
                    new FleetDirectoryService(data, new InMemoryProfileStore(), activity, new AssetImages(images), clock, zone,
                            cacheTtl),
                    new ActivityRollup(data, activity, clock, zone, history, (int) history.toHours()));
        } else if ("gps".equals(source) && gps.configured()) {
            LOG.info("Fleet directory: GPS database, read only; edits in the modulith database");
            FleetData data = new GpsFleetData(gps::readPool);
            ActivityStore activity = new PgActivityStore(modulithPool::get);
            wiring = new Wiring(
                    new FleetDirectoryService(data, new PgProfileStore(modulithPool::get), activity, new AssetImages(images), clock,
                            zone, cacheTtl),
                    new ActivityRollup(data, activity, clock, zone, history, backfillPerRun));
        } else {
            LOG.infof("Fleet directory: none (miot.fleet.source=%s)", source);
            wiring = new Wiring(new FleetDirectoryService(new UnavailableFleetData(), new InMemoryProfileStore(),
                    new InMemoryActivityStore(), clock, zone, cacheTtl), null);
        }
        return wiring;
    }

    /** No source configured: every read answers 503. */
    static final class UnavailableFleetData implements FleetData {

        private static FleetUnavailableException unavailable() {
            return new FleetUnavailableException("Fleet data is not configured");
        }

        @Override
        public List<AssetFacts> assets(Set<String> clientIds) {
            throw unavailable();
        }

        @Override
        public List<TripView> plannedTrips(String assetId) {
            throw unavailable();
        }

        @Override
        public List<TripView> recentTrips(String assetId, int limit) {
            throw unavailable();
        }

        @Override
        public List<ActivityHour> activity(Instant from, Instant to) {
            throw unavailable();
        }
    }
}

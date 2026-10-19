package com.microboxlabs.miot.fleet.sharing;

import com.microboxlabs.miot.core.gps.GpsDatabase;
import com.microboxlabs.miot.fleet.directory.FleetConfig;
import com.microboxlabs.miot.fleet.directory.FleetUnavailableException;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jboss.logging.Logger;

/**
 * Wires data sharing from {@code miot.fleet.source}, like the fleet directory: {@code gps} reads the modulith and GPS
 * databases and keeps shares in {@code miot_fleet}; {@code demo} serves generated organizations and keeps shares in
 * memory; anything else answers 503. With {@code gps}, a job also keeps {@code asset_client_map} in line with the
 * active shares.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class SharingProducer {

    private static final Logger LOG = Logger.getLogger(SharingProducer.class);

    private final Instance<Pool> modulithPool;
    private final GpsDatabase gps;
    private final FleetConfig config;
    private final Clock clock = Clock.systemUTC();
    private SharingService service;
    private ClientMapSync sync;

    SharingProducer(Instance<Pool> modulithPool, GpsDatabase gps, FleetConfig config) {
        this.modulithPool = modulithPool;
        this.gps = gps;
        this.config = config;
    }

    /** Singleton: the service has no no-args constructor, so it cannot sit behind a client proxy. */
    @Produces
    @Singleton
    SharingService service() {
        return wire();
    }

    @Scheduled(every = "${miot.fleet.sharing.sync.every:5m}", delayed = "${miot.fleet.sharing.sync.delay:1m}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduledSync() {
        runSync();
    }

    /** Runs a pass in the background, so a change shows up without waiting for the schedule. */
    public void syncSoon() {
        if (sync() != null) {
            Infrastructure.getDefaultWorkerPool().execute(this::runSync);
        }
    }

    private void runSync() {
        ClientMapSync job = sync();
        if (job == null) {
            return;
        }
        try {
            job.run();
        } catch (RuntimeException e) {
            LOG.warnf(e, "Data sharing: asset_client_map sync failed");
        }
    }

    private synchronized ClientMapSync sync() {
        wire();
        return sync;
    }

    private synchronized SharingService wire() {
        if (service != null) {
            return service;
        }
        String source = config.source();
        if ("demo".equals(source)) {
            LOG.info("Data sharing: demo organizations, shares in memory");
            DemoSharingSource demo = new DemoSharingSource(clock.instant());
            service = new SharingService(demo, new InMemoryShareStore(demo.seedShares(clock.instant()), clock),
                    clock, config.cacheTtl());
        } else if ("gps".equals(source) && gps.configured()) {
            LOG.info("Data sharing: GPS database, shares in the modulith database");
            service = new SharingService(new GpsSharingSource(modulithPool::get, gps::pool),
                    new PgShareStore(modulithPool::get), clock, config.cacheTtl());
            sync = new ClientMapSync(service, new PgClientMapStore(gps::pool));
        } else {
            LOG.infof("Data sharing: none (miot.fleet.source=%s)", source);
            service = new SharingService(new UnavailableSource(), new InMemoryShareStore(List.of(), clock),
                    clock, config.cacheTtl());
        }
        return service;
    }

    /** Read-only for the screens; the sync's pool writes. Both use the one GPS login. */
    /** No source configured: every read answers 503. */
    static final class UnavailableSource implements SharingSource {

        private static FleetUnavailableException unavailable() {
            return new FleetUnavailableException("Data sharing is not configured");
        }

        @Override
        public List<SharingOrg.Ref> organizations() {
            throw unavailable();
        }

        @Override
        public Map<String, Integer> assetCounts(Set<String> clientIds) {
            throw unavailable();
        }

        @Override
        public Set<String> operators(Set<String> clientIds) {
            throw unavailable();
        }

        @Override
        public List<SharingAsset> assets(String clientId) {
            throw unavailable();
        }
    }
}

package com.microboxlabs.miot.fleet.sharing;

import com.microboxlabs.miot.fleet.directory.FleetConfig;
import com.microboxlabs.miot.fleet.directory.FleetDirectoryProducer.Address;
import com.microboxlabs.miot.fleet.directory.FleetUnavailableException;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;
import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.jboss.logging.Logger;

/**
 * Wires data sharing from {@code miot.fleet.source}, like the fleet directory: {@code gps} reads the modulith and GPS
 * databases and keeps shares in {@code miot_fleet}; {@code demo} serves generated organizations and keeps shares in
 * memory; anything else answers 503. With {@code miot.fleet.sharing.sync.enabled} and the {@code gps} source, a job
 * keeps {@code asset_client_map} in line with the active shares.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class SharingProducer {

    private static final Logger LOG = Logger.getLogger(SharingProducer.class);

    private final Vertx vertx;
    private final Instance<Pool> modulithPool;
    private final FleetConfig config;
    private final Clock clock = Clock.systemUTC();
    private final Map<Boolean, Pool> gpsPools = new HashMap<>();
    private SharingService service;
    private ClientMapSync sync;

    SharingProducer(Vertx vertx, Instance<Pool> modulithPool, FleetConfig config) {
        this.vertx = vertx;
        this.modulithPool = modulithPool;
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
        boolean gps = "gps".equals(source) && config.gps().reactiveUrl().filter(s -> !s.isBlank()).isPresent()
                && config.gps().username().filter(s -> !s.isBlank()).isPresent();
        if ("demo".equals(source)) {
            LOG.info("Data sharing: demo organizations, shares in memory");
            DemoSharingSource demo = new DemoSharingSource(clock.instant());
            service = new SharingService(demo, new InMemoryShareStore(demo.seedShares(clock.instant()), clock),
                    clock, config.cacheTtl());
        } else if (gps) {
            LOG.info("Data sharing: GPS database, shares in the modulith database");
            service = new SharingService(new GpsSharingSource(modulithPool::get, () -> gpsPool(true)),
                    new PgShareStore(modulithPool::get), clock, config.cacheTtl());
            if (config.sharing().sync().enabled()) {
                LOG.info("Data sharing: asset_client_map sync on");
                sync = new ClientMapSync(service, new PgClientMapStore(() -> gpsPool(false)));
            }
        } else {
            LOG.infof("Data sharing: none (miot.fleet.source=%s)", source);
            service = new SharingService(new UnavailableSource(), new InMemoryShareStore(List.of(), clock),
                    clock, config.cacheTtl());
        }
        return service;
    }

    /** Read-only for the screens; the sync's pool writes, with its own login when one is set. */
    private synchronized Pool gpsPool(boolean readOnly) {
        return gpsPools.computeIfAbsent(readOnly, key -> newGpsPool(readOnly));
    }

    private Pool newGpsPool(boolean ro) {
        Address address = Address.parse(config.gps().reactiveUrl().orElseThrow());
        FleetConfig.Sharing.Sync syncLogin = config.sharing().sync();
        boolean ownLogin = !ro && syncLogin.username().filter(s -> !s.isBlank()).isPresent();
        Optional<String> user = ownLogin ? syncLogin.username() : config.gps().username();
        Optional<String> password = ownLogin ? syncLogin.password() : config.gps().password();
        PgConnectOptions connect = new PgConnectOptions()
                .setHost(address.host())
                .setPort(address.port())
                .setDatabase(address.database())
                .setUser(user.orElseThrow())
                .setPassword(password.orElse(""))
                .setProperties(Map.of(
                        "application_name", ro ? "miot-sharing" : "miot-sharing-sync",
                        "default_transaction_read_only", ro ? "on" : "off",
                        "TimeZone", "UTC"));
        return PgBuilder.pool().with(new PoolOptions().setMaxSize(ro ? 2 : 1)).connectingTo(connect)
                .using(vertx).build();
    }

    @PreDestroy
    synchronized void close() {
        gpsPools.values().forEach(Pool::closeAndAwait);
    }

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

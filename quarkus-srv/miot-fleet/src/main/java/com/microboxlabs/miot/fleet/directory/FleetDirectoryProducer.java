package com.microboxlabs.miot.fleet.directory;

import com.microboxlabs.miot.core.vehicle.VehicleImages;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
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
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Wires the fleet directory from {@code miot.fleet.source}: {@code gps} reads the GPS database through
 * {@code miot.fleet.gps.*} with read-only sessions and keeps edits in the modulith database; {@code demo} serves
 * fixed data and keeps edits in memory; anything else answers 503.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class FleetDirectoryProducer {

    private static final Logger LOG = Logger.getLogger(FleetDirectoryProducer.class);

    private final Vertx vertx;
    private final Instance<Pool> modulithPool;
    private final VehicleImages images;
    private final String source;
    private final Optional<String> url;
    private final Optional<String> username;
    private final Optional<String> password;
    private final ZoneId zone;
    private final Duration cacheTtl;
    private final Duration history;
    private final int backfillPerRun;
    private final Clock clock = Clock.systemUTC();
    private Pool gpsPool;
    private Wiring wiring;

    FleetDirectoryProducer(Vertx vertx, Instance<Pool> modulithPool, VehicleImages images,
            @ConfigProperty(name = "miot.fleet.source", defaultValue = "none") String source,
            @ConfigProperty(name = "miot.fleet.gps.reactive-url") Optional<String> url,
            @ConfigProperty(name = "miot.fleet.gps.username") Optional<String> username,
            @ConfigProperty(name = "miot.fleet.gps.password") Optional<String> password,
            @ConfigProperty(name = "miot.fleet.zone", defaultValue = "America/Santiago") String zone,
            @ConfigProperty(name = "miot.fleet.cache-ttl", defaultValue = "PT1M") Duration cacheTtl,
            @ConfigProperty(name = "miot.fleet.activity.history", defaultValue = "P14D") Duration history,
            @ConfigProperty(name = "miot.fleet.activity.backfill-per-run", defaultValue = "8") int backfillPerRun) {
        this.vertx = vertx;
        this.modulithPool = modulithPool;
        this.images = images;
        this.source = source;
        this.url = url.filter(s -> !s.isBlank());
        this.username = username.filter(s -> !s.isBlank());
        this.password = password;
        this.zone = ZoneId.of(zone);
        this.cacheTtl = cacheTtl;
        this.history = history;
        this.backfillPerRun = backfillPerRun;
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
                    new FleetDirectoryService(data, new InMemoryProfileStore(), activity, images, clock, zone,
                            cacheTtl),
                    new ActivityRollup(data, activity, clock, zone, history, (int) history.toHours()));
        } else if ("gps".equals(source) && url.isPresent() && username.isPresent()) {
            LOG.info("Fleet directory: GPS database, read only; edits in the modulith database");
            FleetData data = new GpsFleetData(this::gpsPool);
            ActivityStore activity = new PgActivityStore(modulithPool::get);
            wiring = new Wiring(
                    new FleetDirectoryService(data, new PgProfileStore(modulithPool::get), activity, images, clock,
                            zone, cacheTtl),
                    new ActivityRollup(data, activity, clock, zone, history, backfillPerRun));
        } else {
            LOG.infof("Fleet directory: none (miot.fleet.source=%s)", source);
            wiring = new Wiring(new FleetDirectoryService(new UnavailableFleetData(), new InMemoryProfileStore(),
                    new InMemoryActivityStore(), clock, zone, cacheTtl), null);
        }
        return wiring;
    }

    private synchronized Pool gpsPool() {
        if (gpsPool == null) {
            Address address = Address.parse(url.orElseThrow());
            PgConnectOptions connect = new PgConnectOptions()
                    .setHost(address.host())
                    .setPort(address.port())
                    .setDatabase(address.database())
                    .setUser(username.orElseThrow())
                    .setPassword(password.orElse(""))
                    .setProperties(Map.of(
                            "application_name", "miot-fleet",
                            "default_transaction_read_only", "on",
                            "TimeZone", "UTC"));
            gpsPool = PgBuilder.pool().with(new PoolOptions().setMaxSize(3)).connectingTo(connect).using(vertx)
                    .build();
        }
        return gpsPool;
    }

    @PreDestroy
    synchronized void close() {
        if (gpsPool != null) {
            gpsPool.closeAndAwait();
        }
    }

    /** Host, port and database of a {@code postgresql://[user@]host[:port]/db} URL; the scheme is optional. */
    record Address(String host, int port, String database) {

        static Address parse(String url) {
            String rest = url.replaceFirst("^postgres(ql)?://", "");
            int query = rest.indexOf('?');
            if (query >= 0) {
                rest = rest.substring(0, query);
            }
            int at = rest.lastIndexOf('@');
            if (at >= 0) {
                rest = rest.substring(at + 1);
            }
            int slash = rest.indexOf('/');
            String hostPort = slash >= 0 ? rest.substring(0, slash) : rest;
            String database = slash >= 0 && slash + 1 < rest.length() ? rest.substring(slash + 1) : "prod_iot_gps";
            int colon = hostPort.lastIndexOf(':');
            if (colon > 0) {
                return new Address(hostPort.substring(0, colon), Integer.parseInt(hostPort.substring(colon + 1)),
                        database);
            }
            return new Address(hostPort.isEmpty() ? "localhost" : hostPort, 5432, database);
        }
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

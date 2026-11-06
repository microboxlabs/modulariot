package com.microboxlabs.miot.symptoms.signal;

import cl.streamhub.gps.model.EnvelopedMessage;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.microboxlabs.miot.core.db.PgNotificationListener;
import com.microboxlabs.miot.core.gps.GpsDatabase;
import com.microboxlabs.miot.symptoms.signal.ReferenceCache.Share;
import com.microboxlabs.miot.symptoms.signal.ReferenceCache.Trip;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.Uni;
import io.smallrye.reactive.messaging.pulsar.PulsarOutgoingMessageMetadata;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Instance;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.eclipse.microprofile.reactive.messaging.Outgoing;
import org.jboss.logging.Logger;

/**
 * The signal builder: reads GPS frames ({@code gps-frames}), joins each client's
 * trip and the vehicle's clients, and publishes {@code miot.gps.signal@1} keyed
 * by vehicle id ({@code gps-signals}). Trips are the modulith's
 * {@code miot_trips.trip_live} rows, kept current from the
 * {@code miot_trips_live} notices; shares are the GPS database's
 * {@code asset_client_map}, kept current from its Debezium topic
 * ({@code signal-asset-client-map}). Both are loaded in full at start and every
 * {@code reload-every}, with the GPS database's {@code geofences} ({@link Zones}). Off unless {@code miot.symptoms.signal-builder.enabled};
 * the channels are disabled with it. Frames are never logged, only counted.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SignalStream {

    private static final Logger LOG = Logger.getLogger(SignalStream.class);

    /** Absent values are left out, so {@code has()} in a rule is true only for a value the device sent. */
    static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .setSerializationInclusion(JsonInclude.Include.NON_NULL);

    static final String TRIPS_CHANNEL = "miot_trips_live";
    private static final String UNDEFINED_TABLE = "42P01";
    private static final String SHAPE = "shape";

    @ConfigMapping(prefix = "miot.symptoms.signal-builder.roads")
    public interface RoadSettings {
        @WithDefault("true")
        boolean enabled();

        @WithDefault("5000")
        int maxTiles();

        @WithDefault("24h")
        Duration ttl();
    }

    /**
     * As JSON, so a loaded row and a notified one read alike. Names and phones are not selected: the carrier's
     * tax id and the driver's fleet id, status and license come from the fleet.
     */
    static final String TRIPS_SQL = """
            SELECT row_to_json(t)::text AS trip FROM (
                SELECT tl.trip_id, tl.tenant_code, tl.asset_id, tl.trip_type, tl.status,
                       coalesce((SELECT m.confirmed_at FROM miot_trips.trip_milestone m
                                  WHERE m.tenant_code = tl.tenant_code AND m.trip_id = tl.trip_id
                                    AND m.milestone = 'departure' AND m.status = 'confirmed'),
                                (SELECT min(s.actual_start) FROM miot_trips.stage s
                                  WHERE s.tenant_code = tl.tenant_code AND s.subject_type = 'trip'
                                    AND s.subject_id = tl.trip_id AND s.stage_type IN ('transit', 'stop')
                                    AND s.version_of IS NULL AND s.is_active)) AS start_time, tl.end_time,
                       tl.double_driver, tl.estimated_arrival_time,
                       (CASE jsonb_typeof(tl.mandate_codes) WHEN 'string' THEN (tl.mandate_codes #>> '{}')::jsonb
                             ELSE tl.mandate_codes END) -> 0 ->> 'code' AS code,
                       tl.origin_geofence_id, tl.origin_geofence_label, tl.origin_visited, tl.origin_is_internal,
                       tl.destination_geofence_id, tl.destination_geofence_label,
                       tl.destination_visited OR EXISTS (
                           SELECT 1 FROM miot_trips.trip_milestone m
                            WHERE m.tenant_code = tl.tenant_code AND m.trip_id = tl.trip_id
                              AND m.milestone = 'arrival' AND m.status = 'confirmed') AS destination_visited,
                       tl.current_geofence_id, c.rut AS carrier_tax_id, tl.carrier_name, tl.type_load,
                       tl.rampla_plate, tl.driver_id IS NOT NULL AS driver_assigned, d.id AS driver_fleet_id,
                       d.status AS driver_status, d.license_expires AS driver_license_expires
                  FROM miot_trips.trip_live tl
                  LEFT JOIN miot_fleet.carrier c ON c.tenant_code = tl.tenant_code AND c.id::text = tl.carrier_id
                  LEFT JOIN LATERAL (
                       SELECT id, status, license_expires FROM miot_fleet.driver
                        WHERE tenant_code = tl.tenant_code AND rut = tl.driver_id
                          AND version_of IS NULL AND is_active
                        ORDER BY status = 'active' DESC LIMIT 1) d ON true
                 WHERE tl.asset_id IS NOT NULL %s) t
            """;
    private static final String ALL_TRIPS = TRIPS_SQL.formatted("");
    private static final String ONE_TRIP = TRIPS_SQL.formatted("AND tl.trip_id = $1");
    private static final String SHARES = """
            SELECT asset_id, shared_client_id, active, valid_from, valid_to FROM asset_client_map WHERE active
            """;

    /** The GPS database's geofences as GeoJSON, read in full: a few hundred rows. */
    private static final String ZONES_SQL = """
            SELECT client_id, geofence_id, properties ->> 'geofence_type' AS geofence_type,
                   ST_AsGeoJSON(coordinates::geometry) AS shape
              FROM geofences WHERE coordinates IS NOT NULL
            """;

    /**
     * The route history's cells for any start hour and any number of drivers, as the GPS database's signal function
     * reads them: a few thousand rows.
     */
    static final String ROUTE_ETAS_SQL = """
            SELECT origin_geofence_id::int AS origin_id, destination_geofence_id::int AS destination_id, from_token,
                   p75_dinamic_eta
              FROM s2cell_triproute_transition_stats
             WHERE double_driver IS NULL AND start_hour IS NULL AND p75_dinamic_eta IS NOT NULL
            """;

    /** One tile of the road network: the ways whose box meets it. */
    static final String ROADS_SQL = """
            SELECT osm_id::bigint AS osm_id, fclass, spwlte38::int AS light, spwgt38::int AS heavy,
                   maxspeed::int AS maxspeed, ST_AsBinary(geom) AS wkb
              FROM osm_roads_weight WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
            """;

    /** Each organization's own speed limits, read in full. */
    static final String SPEED_ZONES_SQL = """
            SELECT tenant_code, id, speed_forward, speed_backward, forward_from, forward_to, heading, shape::text AS shape
              FROM miot_symptoms.speed_limit_zone WHERE active
            """;

    private final boolean enabled;
    private final GpsDatabase gps;
    private final Supplier<Pool> pool;
    private final ReferenceCache refs = new ReferenceCache();
    private final Zones zones = new Zones();
    private final SpeedZones speedZones = new SpeedZones();
    private final Bearings bearings = new Bearings(Duration.ofMinutes(10));
    private final RouteEtas routeEtas = new RouteEtas();
    private final RoadNetwork roads;
    private final SignalBuilder builder;
    private final TripNoticeReader tripReader;
    private final Counter built;
    private final Counter skipped;
    private final Counter roadFailures;
    private final CompletableFuture<Void> ready = new CompletableFuture<>();
    private final PgNotificationListener listener;

    SignalStream(@ConfigProperty(name = "miot.symptoms.signal-builder.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.signal-builder.zone", defaultValue = "America/Santiago") String zone,
            RoadSettings roadSettings,
            GpsDatabase gps, Instance<Pool> pool, Vertx vertx, MeterRegistry meters) {
        this.enabled = enabled;
        this.gps = gps;
        this.pool = pool::get;
        this.listener = new PgNotificationListener(this.pool, vertx, TRIPS_CHANNEL, this::onTripNotice);
        this.tripReader = new TripNoticeReader(refs, id -> this.pool.get().preparedQuery(ONE_TRIP)
                .execute(Tuple.of(id)).map(SignalStream::trips));
        this.roadFailures = meters.counter("miot.symptoms.signal.road_tile_failures");
        this.roads = roadSettings.enabled()
                ? new RoadNetwork(this::ways, roadSettings.maxTiles(), roadSettings.ttl(), Clock.systemUTC()) : null;
        this.builder = new SignalBuilder(refs, ZoneId.of(zone), zones, roads, speedZones, bearings, routeEtas);
        if (roads != null) {
            meters.gauge("miot.symptoms.signal.road_tiles", roads, RoadNetwork::tileCount);
            meters.gauge("miot.symptoms.signal.road_bytes", roads, RoadNetwork::bytes);
        }
        this.built = meters.counter("miot.symptoms.signal.built");
        this.skipped = meters.counter("miot.symptoms.signal.skipped");
    }

    /**
     * Frames wait for the first reference load, so a vehicle's first frames are not published without its trip
     * and shared clients. The first load is retried until the databases answer.
     */
    void onStart(@Observes StartupEvent ignored) {
        if (!enabled) {
            return;
        }
        if (!gps.configured()) {
            LOG.warn("Signal builder: the GPS database is not configured; signals have no shared clients");
        }
        listener.start();
        reload().onFailure().invoke(e -> LOG.errorf(e, "Signal builder: reference load failed; frames wait"))
                .onFailure().retry().withBackOff(Duration.ofSeconds(1), Duration.ofMinutes(1)).indefinitely()
                .subscribe().with(x -> ready.complete(null));
    }

    void onStop(@Observes ShutdownEvent ignored) {
        listener.close();
    }

    @Scheduled(every = "${miot.symptoms.signal-builder.reload-every:10m}", delayed = "10m",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    Uni<Void> scheduledReload() {
        if (!enabled || !ready.isDone()) {
            return Uni.createFrom().voidItem();
        }
        return reload().onFailure().invoke(e -> LOG.errorf(e, "Signal builder: reference load failed"))
                .onFailure().recoverWithNull();
    }

    private Uni<Void> reload() {
        return Uni.createFrom().deferred(() -> {
            tripReader.invalidate();
            refs.beginReload();
            return loadTrips();
        }).chain(t -> loadShares().map(s -> {
            refs.load(t, s);
            LOG.infof("Signal builder: loaded %d trips, %d shares", t.size(), s.size());
            return t.size();
        })).chain(n -> loadZones()).invoke(z -> {
            if (gps.configured()) {
                zones.load(z);
                LOG.infof("Signal builder: loaded %d zones", z.size());
            }
        }).chain(z -> loadRouteEtas()).invoke(c -> {
            if (gps.configured()) {
                routeEtas.load(c);
                LOG.infof("Signal builder: loaded %d route cells", c.size());
            }
        }).chain(c -> loadSpeedZones()).invoke(z -> {
            speedZones.load(z);
            bearings.prune(java.time.Instant.now());
            LOG.infof("Signal builder: loaded %d speed limit zones", z.size());
        }).replaceWithVoid();
    }

    /** No zones when the modulith has no speed limit zones table yet; a shape that is not a polygon is skipped. */
    private Uni<List<SpeedZones.Zone>> loadSpeedZones() {
        return pool.get().query(SPEED_ZONES_SQL).execute().map(rows -> {
            List<SpeedZones.Zone> z = new ArrayList<>();
            rows.forEach(r -> {
                SpeedZones.Zone zone = r.getString(SHAPE) == null ? null : SpeedZones.zone(r.getString("tenant_code"),
                        r.getInteger("id"), new SpeedZones.Limits(r.getInteger("speed_forward"), r.getInteger("speed_backward"),
                                r.getInteger("forward_from"), r.getInteger("forward_to"), r.getInteger("heading")),
                        r.getString(SHAPE));
                if (zone != null) {
                    z.add(zone);
                }
            });
            return z;
        }).onFailure(SignalStream::undefinedTable).recoverWithItem(e -> List.of());
    }

    /** No cells without the GPS database or its route history: the signal then has no ETA deviation. */
    private Uni<List<RouteEtas.Cell>> loadRouteEtas() {
        if (!gps.configured()) {
            return Uni.createFrom().item(List.of());
        }
        return gps.readPool().query(ROUTE_ETAS_SQL).execute().map(rows -> {
            List<RouteEtas.Cell> c = new ArrayList<>(rows.size());
            rows.forEach(r -> c.add(new RouteEtas.Cell(r.getInteger("origin_id"), r.getInteger("destination_id"),
                    r.getString("from_token"), r.getInteger("p75_dinamic_eta"))));
            return c;
        }).onFailure(SignalStream::undefinedTable).recoverWithItem(e -> List.of());
    }

    /** No ways without the GPS database. */
    private Uni<List<RoadNetwork.Way>> ways(double minLon, double minLat, double maxLon, double maxLat) {
        if (!gps.configured()) {
            return Uni.createFrom().item(List.of());
        }
        return gps.readPool().preparedQuery(ROADS_SQL).execute(Tuple.of(minLon, minLat, maxLon, maxLat))
                .map(rows -> {
                    List<RoadNetwork.Way> w = new ArrayList<>(rows.size());
                    rows.forEach(r -> w.add(new RoadNetwork.Way(r.getLong("osm_id"), r.getString("fclass"),
                            r.getInteger("light"), r.getInteger("heavy"), r.getInteger("maxspeed"),
                            r.getBuffer("wkb").getBytes())));
                    return w;
                }).onFailure().invoke(e -> {
                    roadFailures.increment();
                    LOG.debugf("Signal builder: road tile not read (%s)", rootCause(e));
                });
    }

    /** No zones without the GPS database; a shape that is not a polygon is skipped. */
    private Uni<List<Zones.Zone>> loadZones() {
        if (!gps.configured()) {
            return Uni.createFrom().item(List.of());
        }
        return gps.readPool().query(ZONES_SQL).execute().map(rows -> {
            List<Zones.Zone> z = new ArrayList<>();
            rows.forEach(r -> {
                Zones.Zone zone = r.getString(SHAPE) == null ? null : Zones.zone(r.getString("client_id"),
                        r.getInteger("geofence_id"), r.getString("geofence_type"), r.getString(SHAPE));
                if (zone != null) {
                    z.add(zone);
                }
            });
            return z;
        });
    }

    /** No trips when the modulith has no trips module. */
    private Uni<List<Trip>> loadTrips() {
        return pool.get().query(ALL_TRIPS).execute().map(SignalStream::trips)
                .onFailure(SignalStream::undefinedTable).recoverWithItem(e -> {
                    LOG.warn("Signal builder: the modulith has no trips; signals have no trip");
                    return List.of();
                });
    }

    private Uni<List<Share>> loadShares() {
        if (!gps.configured()) {
            return Uni.createFrom().item(List.of());
        }
        return gps.readPool().query(SHARES).execute().map(rows -> {
            List<Share> s = new ArrayList<>();
            rows.forEach(r -> s.add(new Share(r.getString("asset_id"), r.getString("shared_client_id"),
                    Boolean.TRUE.equals(r.getBoolean("active")), instant(r, "valid_from"), instant(r, "valid_to"))));
            return s;
        });
    }

    static List<Trip> trips(RowSet<Row> rows) {
        List<Trip> t = new ArrayList<>();
        rows.forEach(r -> t.add(ReferenceCache.trip(new JsonObject(r.getString("trip")))));
        return t;
    }

    static boolean undefinedTable(Throwable e) {
        return e instanceof PgException pg && UNDEFINED_TABLE.equals(pg.getSqlState());
    }

    /** A notice names a trip whose row changed: it is read again, or dropped when it no longer has one. */
    void onTripNotice(String payload) {
        UUID tripId;
        try {
            tripId = UUID.fromString(new JsonObject(payload).getString("tripId"));
        } catch (RuntimeException e) {
            LOG.debugf("Signal builder: trip notice ignored (%s)", e.getClass().getSimpleName());
            return;
        }
        tripReader.read(tripId);
    }

    @Incoming("gps-frames")
    @Outgoing("gps-signals")
    public Multi<Message<String>> build(Message<byte[]> in) {
        if (ready.isDone()) {
            return buildNow(in);
        }
        return Uni.createFrom().completionStage(ready::copy).onItem().transformToMulti(x -> buildNow(in));
    }

    /** The frame's road tile is loaded first, so its signal has the road limit. */
    private Multi<Message<String>> buildNow(Message<byte[]> in) {
        EnvelopedMessage message;
        try {
            message = EnvelopedMessage.fromJson(new String(in.getPayload(), StandardCharsets.UTF_8));
        } catch (RuntimeException e) {
            LOG.debugf("Signal builder: frame not read (%s)", rootCause(e));
            message = null;
        }
        EnvelopedMessage read = message;
        if (roads == null || read == null || !SignalBuilder.validFrame(read.getPayload())
                || !SignalBuilder.hasPosition(read.getPayload())) {
            return publish(in, read);
        }
        var gpsPart = read.getPayload().getGps();
        return roads.ensure(gpsPart.getLongitude(), gpsPart.getLatitude()).onItem()
                .transformToMulti(x -> publish(in, read));
    }

    private Multi<Message<String>> publish(Message<byte[]> in, EnvelopedMessage message) {
        GpsSignal signal;
        try {
            signal = message == null ? null : builder.build(message).orElse(null);
        } catch (RuntimeException e) {
            LOG.debugf("Signal builder: frame not read (%s)", rootCause(e));
            signal = null;
        }
        if (signal == null) {
            skipped.increment();
            return Uni.createFrom().completionStage(in::ack).onItem().transformToMulti(x -> Multi.createFrom().empty());
        }
        String json;
        try {
            json = JSON.writeValueAsString(signal);
        } catch (Exception e) {
            LOG.debugf("Signal builder: signal not written (%s)", rootCause(e));
            skipped.increment();
            return Uni.createFrom().completionStage(in::ack).onItem().transformToMulti(x -> Multi.createFrom().empty());
        }
        built.increment();
        return Multi.createFrom().item(in.withPayload(json)
                .addMetadata(PulsarOutgoingMessageMetadata.builder().withKey(signal.assetId()).build()));
    }

    @Incoming("signal-asset-client-map")
    public Uni<Void> onShare(Message<byte[]> in) {
        if (in.getPayload() != null && in.getPayload().length > 0) { // empty: Debezium's tombstone after a delete
            try {
                refs.applyShare(new JsonObject(new String(in.getPayload(), StandardCharsets.UTF_8)));
            } catch (RuntimeException e) {
                LOG.warnf("Signal builder: change event skipped (%s)", e.getClass().getSimpleName());
            }
        }
        return Uni.createFrom().completionStage(in::ack);
    }

    /** The innermost exception's type and the first frame in our code: never the frame's content. */
    static String rootCause(Throwable e) {
        Throwable root = e;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        StackTraceElement at = java.util.Arrays.stream(root.getStackTrace())
                .filter(f -> f.getClassName().startsWith("com.microboxlabs") || f.getClassName().startsWith("cl.streamhub"))
                .findFirst().orElse(null);
        return root.getClass().getSimpleName() + (at == null ? "" : " at " + at.getClassName() + ":" + at.getLineNumber());
    }

    private static java.time.Instant instant(Row r, String column) {
        OffsetDateTime t = r.getOffsetDateTime(column);
        return t == null ? null : t.toInstant();
    }
}

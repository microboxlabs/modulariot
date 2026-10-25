package com.microboxlabs.miot.trips.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.TripLiveRow;
import com.microboxlabs.miot.trips.geo.GeoShape;
import com.microboxlabs.miot.trips.geo.GeofenceEdges;
import com.microboxlabs.miot.trips.store.GeofenceDirectory;
import com.microboxlabs.miot.trips.store.TripLiveStore;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.common.annotation.Blocking;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.jboss.logging.Logger;

/**
 * Turns GPS signals ({@code miot.gps.signal@1}) into trip signals. A trip is watched while its hot row has a vehicle
 * and a geofence (origin, destination or stop). When the vehicle's position moves it into or out of one of them for
 * {@code confirm} frames in a row, the trip's motor state is saved and the trip gets {@code left_origin},
 * {@code entered_destination} and the like, with the geofence id. The watched trips are read every
 * {@code refresh-every}; the shapes come from the GPS database and are read again every {@code shapes-every}.
 * Frames older than the vehicle's last one are skipped.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class GeofenceSignals {

    public static final String ACTOR = "gps:geofences";
    private static final Logger LOG = Logger.getLogger(GeofenceSignals.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Where a signal goes: the monitor engine. */
    @FunctionalInterface
    public interface Sink {
        void signal(String tenantCode, UUID tripId, String kind, int geofenceId, OffsetDateTime at);
    }

    /** A watched trip; {@code watch} changes as its vehicle moves. */
    private static final class Watched {
        private final String tenantCode;
        private final UUID tripId;
        private GeofenceEdges.Watch watch;

        private Watched(String tenantCode, UUID tripId, GeofenceEdges.Watch watch) {
            this.tenantCode = tenantCode;
            this.tripId = tripId;
            this.watch = watch;
        }
    }

    private record Pending(Integer zone, int frames) {
    }

    private final TripLiveStore live;
    private final GeofenceDirectory geofences;
    private final Sink sink;
    private final Transactions tx;
    private final Clock clock;
    private final boolean enabled;
    private final int confirm;
    private final Duration shapesEvery;
    private volatile Map<String, List<Watched>> byAsset = Map.of();
    private final Map<Integer, GeoShape> shapes = new ConcurrentHashMap<>();
    private final Map<UUID, Pending> pending = new ConcurrentHashMap<>();
    private final Map<String, Instant> lastFrame = new ConcurrentHashMap<>();
    private volatile Instant shapesLoadedAt = Instant.EPOCH;
    private volatile int watchedCount = -1;

    @Inject
    GeofenceSignals(TripLiveStore live, GeofenceDirectory geofences, MonitorEngine engine, Transactions tx,
            @ConfigProperty(name = "miot.trips.geofences.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.trips.geofences.confirm-frames", defaultValue = "2") int confirm,
            @ConfigProperty(name = "miot.trips.geofences.shapes-every", defaultValue = "10m") Duration shapesEvery) {
        this(live, geofences, (tenant, trip, kind, geofence, at) -> engine.signal(tenant, ACTOR, trip, kind,
                String.valueOf(geofence), at), tx, Clock.systemUTC(), enabled, confirm, shapesEvery);
    }

    public GeofenceSignals(TripLiveStore live, GeofenceDirectory geofences, Sink sink, Transactions tx, Clock clock,
            boolean enabled, int confirm, Duration shapesEvery) {
        this.live = live;
        this.geofences = geofences;
        this.sink = sink;
        this.tx = tx;
        this.clock = clock;
        this.enabled = enabled;
        this.confirm = Math.max(1, confirm);
        this.shapesEvery = shapesEvery;
    }

    @Scheduled(every = "${miot.trips.geofences.refresh-every:30s}", delayed = "${miot.trips.monitors.clock.delay:60s}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduledRefresh() {
        if (enabled) {
            try {
                refresh();
            } catch (RuntimeException e) {
                LOG.error("Trip geofences: refresh failed", e);
            }
        }
    }

    /** Reads the watched trips, and the shapes not loaded yet (all of them every {@code shapes-every}). */
    public synchronized void refresh() {
        Map<String, List<Watched>> next = new HashMap<>();
        Set<Integer> needed = new HashSet<>();
        for (TripLiveRow r : live.watched()) {
            GeofenceEdges.Watch w = new GeofenceEdges.Watch(r.originGeofenceId(), r.destinationGeofenceId(),
                    r.stopGeofenceIds(), r.currentGeofenceId(), r.originVisited(), r.destinationVisited());
            needed.addAll(w.geofences());
            String assetKey = asset(r.assetId());
            boolean unchanged = byAsset.getOrDefault(assetKey, List.of()).stream()
                    .anyMatch(previous -> previous.tripId.toString().equals(r.tripId()) && previous.watch.equals(w));
            if (!unchanged) {
                pending.remove(UUID.fromString(r.tripId()));
            }
            next.computeIfAbsent(assetKey, k -> new ArrayList<>())
                    .add(new Watched(r.tenantCode(), UUID.fromString(r.tripId()), w));
        }
        Instant now = clock.instant();
        boolean all = !shapesLoadedAt.plus(shapesEvery).isAfter(now);
        Set<Integer> load = new HashSet<>(needed);
        if (!all) {
            load.removeAll(shapes.keySet());
        }
        if (!load.isEmpty()) {
            Map<Integer, String> loaded = geofences.shapes(load);
            load.forEach(shapes::remove);
            loaded.forEach((id, geojson) -> {
                try {
                    shapes.put(id, GeoShape.parse(geojson));
                } catch (IllegalArgumentException e) {
                    LOG.warnf("Trip geofences: geofence %d has no usable shape (%s)", id, e.getMessage());
                }
            });
        }
        if (!load.isEmpty()) {
            next.values().forEach(list -> list.forEach(w -> {
                if (w.watch.geofences().stream().anyMatch(load::contains)) {
                    pending.remove(w.tripId);
                }
            }));
        }
        if (all) {
            shapes.keySet().retainAll(needed);
            shapesLoadedAt = now;
        }
        Set<UUID> watched = new HashSet<>();
        next.values().forEach(list -> list.forEach(w -> watched.add(w.tripId)));
        pending.keySet().retainAll(watched);
        lastFrame.keySet().retainAll(next.keySet());
        if (watched.size() != watchedCount) {
            LOG.infof("Trip geofences: watching %d trips, %d geofences with a shape", watched.size(), shapes.size());
            watchedCount = watched.size();
        }
        byAsset = next;
    }

    @Incoming("trip-gps-signals")
    @Blocking
    public CompletionStage<Void> onSignal(Message<byte[]> in) {
        try {
            accept(new String(in.getPayload(), StandardCharsets.UTF_8));
        } catch (IllegalArgumentException e) {
            LOG.debugf("Trip geofences: signal skipped (%s)", e.getMessage());
        }
        return in.ack();
    }

    /** Reads one GPS signal; returns how many trip signals it gave. */
    public synchronized int accept(String json) {
        JsonNode signal = parseSignal(json);
        String asset = asset(signal.path("asset_id").asText(null));
        List<Watched> trips = asset == null ? null : byAsset.get(asset);
        if (trips == null) {
            return 0;
        }
        JsonNode gps = signal.path("frame").path("gps");
        if (!validPosition(gps)) {
            return 0;
        }
        double lon = gps.path("longitude").asDouble();
        double lat = gps.path("latitude").asDouble();
        Instant at;
        try {
            at = Instant.parse(signal.path("at").asText());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("not a signal time", e);
        }
        Instant previous = lastFrame.get(asset);
        if (previous != null && !at.isAfter(previous)) {
            return 0;
        }
        lastFrame.put(asset, at);
        Set<String> clients = new HashSet<>();
        signal.path("clients").forEach(c -> clients.add(c.asText()));
        int given = 0;
        for (Watched w : trips) {
            if (clients.contains(w.tenantCode) && shapes.keySet().containsAll(w.watch.geofences())) {
                given += track(w, GeofenceEdges.zoneOf(w.watch, shapes, lon, lat), at);
            }
        }
        return given;
    }

    private static JsonNode parseSignal(String json) {
        JsonNode signal;
        try {
            signal = JSON.readTree(json);
        } catch (Exception e) {
            throw new IllegalArgumentException("not a signal", e);
        }
        if (signal == null || !signal.isObject()) {
            throw new IllegalArgumentException("not a signal object");
        }
        return signal;
    }

    private static boolean validPosition(JsonNode gps) {
        if (!gps.path("latitude").isNumber() || !gps.path("longitude").isNumber()) {
            return false;
        }
        double lon = gps.path("longitude").asDouble();
        double lat = gps.path("latitude").asDouble();
        return Double.isFinite(lon) && Double.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
    }

    private int track(Watched w, Integer zone, Instant at) {
        if (Objects.equals(zone, w.watch.current())) {
            pending.remove(w.tripId);
            return 0;
        }
        Pending p = pending.merge(w.tripId, new Pending(zone, 1),
                (old, fresh) -> Objects.equals(old.zone(), zone) ? new Pending(zone, old.frames() + 1) : fresh);
        if (p.frames() < confirm) {
            return 0;
        }
        pending.remove(w.tripId);
        GeofenceEdges.Move move = GeofenceEdges.move(w.watch, zone);
        OffsetDateTime when = at.atOffset(ZoneOffset.UTC);
        try {
            tx.inTransaction(() -> {
                live.saveMotorState(w.tenantCode, w.tripId, move.current(), move.originVisited(),
                        move.destinationVisited());
                move.edges().forEach(e -> sink.signal(w.tenantCode, w.tripId, e.kind(), e.geofenceId(), when));
                return null;
            });
        } catch (RuntimeException e) {
            // the watch keeps its state, so the next frames find the same move again
            LOG.warnf(e, "Trip geofences: trip %s move to %s not applied", w.tripId, zone);
            return 0;
        }
        w.watch = new GeofenceEdges.Watch(w.watch.origin(), w.watch.destination(), w.watch.stops(), move.current(),
                move.originVisited(), move.destinationVisited());
        return move.edges().size();
    }

    /** Plates compare without case, spaces or dashes: "abc 123" is "ABC-123". */
    static String asset(String id) {
        if (id == null) {
            return null;
        }
        String key = id.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        return key.isEmpty() ? null : key;
    }
}

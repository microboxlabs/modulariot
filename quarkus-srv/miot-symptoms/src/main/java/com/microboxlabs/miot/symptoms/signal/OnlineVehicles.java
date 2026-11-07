package com.microboxlabs.miot.symptoms.signal;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Vehicles with a frame in the last {@code window}, by device time: per operator the vehicle is shared with, per
 * sender, moving, and in total. Gauges per tag value, registered when the value first appears and kept at 0 when it
 * has no vehicles. Memory is one entry per vehicle seen in the window.
 */
public final class OnlineVehicles {

    @ConfigMapping(prefix = "miot.symptoms.signal-builder.online")
    public interface Settings {
        @WithDefault("15m")
        Duration window();

        /** km/h; a vehicle whose last frame is faster counts as moving. */
        @WithDefault("5")
        double movingSpeed();
    }

    static final String NONE = "none";
    static final String ONLINE = "miot.symptoms.vehicles.online";
    static final String SENDERS = "miot.symptoms.vehicles.online.senders";
    static final String MOVING = "miot.symptoms.vehicles.moving";
    static final String TOTAL = "miot.symptoms.vehicles.online.total";
    /** A frame stamped later than now plus this is ignored: a device clock ahead would keep it online. */
    static final Duration FUTURE_TOLERANCE = Duration.ofMinutes(2);
    /** Gauges read one count computed at most this often, not one per gauge. */
    private static final Duration CACHE = Duration.ofSeconds(5);

    record Last(Instant at, boolean moving, String sender, List<String> tenants) {
    }

    record Counts(Map<String, Integer> online, Map<String, Integer> moving, Map<String, Integer> senders, int total) {
    }

    private final Duration window;
    private final double movingSpeed;
    private final Clock clock;
    private final MeterRegistry meters;
    private final Map<String, Last> vehicles = new ConcurrentHashMap<>();
    private final Set<String> tenantGauges = ConcurrentHashMap.newKeySet();
    private final Set<String> senderGauges = ConcurrentHashMap.newKeySet();
    private volatile Counts cached = new Counts(Map.of(), Map.of(), Map.of(), 0);
    private volatile Instant cachedAt = Instant.MIN;

    public OnlineVehicles(Duration window, double movingSpeed, Clock clock, MeterRegistry meters) {
        this.window = window;
        this.movingSpeed = movingSpeed;
        this.clock = clock;
        this.meters = meters;
        Gauge.builder(TOTAL, this, v -> v.cached().total()).strongReference(true).register(meters);
    }

    /**
     * A vehicle's frame. Its operators are the shares valid at the frame time; none counts under {@code none}.
     * An older frame than the vehicle's last one changes nothing.
     */
    public void seen(String assetId, String sender, Instant at, double speed, List<String> tenants) {
        if (assetId == null || at == null) {
            return;
        }
        Instant now = clock.instant();
        if (at.isAfter(now.plus(FUTURE_TOLERANCE)) || !at.isAfter(now.minus(window))) {
            return;
        }
        List<String> t = tenants == null || tenants.isEmpty() ? List.of(NONE) : List.copyOf(tenants);
        String s = sender == null || sender.isBlank() ? NONE : sender;
        Last next = new Last(at, speed > movingSpeed, s, t);
        vehicles.merge(assetId, next, (old, n) -> n.at().isBefore(old.at()) ? old : n);
        t.forEach(this::tenantGauges);
        senderGauge(s);
    }

    /** Drops the vehicles out of the window and counts the rest. */
    Counts counts() {
        Instant from = clock.instant().minus(window);
        vehicles.entrySet().removeIf(e -> !e.getValue().at().isAfter(from));
        Map<String, Integer> online = new HashMap<>();
        Map<String, Integer> moving = new HashMap<>();
        Map<String, Integer> senders = new HashMap<>();
        int total = 0;
        for (Last v : vehicles.values()) {
            total++;
            senders.merge(v.sender(), 1, Integer::sum);
            for (String tenant : v.tenants()) {
                online.merge(tenant, 1, Integer::sum);
                if (v.moving()) {
                    moving.merge(tenant, 1, Integer::sum);
                }
            }
        }
        return new Counts(online, moving, senders, total);
    }

    /** Drops the vehicles out of the window, for when nothing reads the gauges. */
    void prune() {
        cached = counts();
        cachedAt = clock.instant();
    }

    private Counts cached() {
        Instant now = clock.instant();
        if (now.isAfter(cachedAt.plus(CACHE)) || now.isBefore(cachedAt)) {
            prune();
        }
        return cached;
    }

    private void tenantGauges(String tenant) {
        if (tenantGauges.add(tenant)) {
            Gauge.builder(ONLINE, this, v -> v.cached().online().getOrDefault(tenant, 0)).tag("tenant", tenant)
                    .strongReference(true).register(meters);
            Gauge.builder(MOVING, this, v -> v.cached().moving().getOrDefault(tenant, 0)).tag("tenant", tenant)
                    .strongReference(true).register(meters);
        }
    }

    private void senderGauge(String sender) {
        if (senderGauges.add(sender)) {
            Gauge.builder(SENDERS, this, v -> v.cached().senders().getOrDefault(sender, 0)).tag("sender", sender)
                    .strongReference(true).register(meters);
        }
    }
}

package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.cases.HoldIndex;
import com.microboxlabs.miot.symptoms.cases.HoldStore;
import com.microboxlabs.miot.symptoms.cases.IgnoreHold;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomTemplate;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService;
import com.microboxlabs.miot.symptoms.catalog.service.SymptomCatalogService.CreateRequest;
import com.microboxlabs.miot.symptoms.duty.InMemoryDutyStore;
import com.microboxlabs.miot.symptoms.duty.RedisDutyStore;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.lostsignal.InMemoryLossStore;
import com.microboxlabs.miot.symptoms.lostsignal.LossSettings;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector;
import com.microboxlabs.miot.symptoms.lostsignal.LostSignalDetector.TickerSettings;
import com.microboxlabs.miot.symptoms.lostsignal.RedisLossStore;
import com.microboxlabs.miot.symptoms.lostsignal.TripChecks;
import com.microboxlabs.miot.symptoms.service.AuditService;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import com.microboxlabs.miot.symptoms.signal.SignalSamplesAccess;
import com.microboxlabs.miot.symptoms.store.InMemoryAuditStore;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadMXBean;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.LockSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Replays synthetic GPS signals through the whole evaluator ({@link EvaluatorStream#evaluate(String, Instant)}):
 * the platform templates published for one organization (6 ACTIVE, the rest TEST, as in production), the
 * lost-signal detector, the duty tracker, the samples and the event-type counts, all on {@link FakeRedis}. Holds
 * and the transition log stand in for Postgres with a fixed latency.
 *
 * <p>Run with {@code -Dmiot.symptoms.benchmark=true}. Settings: {@code bench.redis-us} (Redis round trip, default
 * 2400, as measured in production), {@code bench.pg-us} (Postgres query, default 2000), {@code bench.signals}
 * (default 3000 for the latency runs), {@code bench.lanes} (default 8), {@code bench.jfr} (a file to record the
 * no-latency run to with JFR's profile settings). It prints signals/s on one CPU without
 * latency, the round trips per signal, and signals/s with latency, one at a time and in vehicle-keyed lanes.
 */
@EnabledIfSystemProperty(named = "miot.symptoms.benchmark", matches = "true")
class EvaluatorBenchmarkTest {

    static final String ORG = "org-a";
    static final String OTHER = "org-b";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int ACTIVE = 6;

    /** One evaluator over its own fake Redis and fake Postgres, with counters. */
    static final class Env {
        final FakeRedis redis;
        final EvaluatorStream stream;
        final AtomicLong holdQueries = new AtomicLong();
        final AtomicLong logAppends = new AtomicLong();
        final InMemoryTransitionLog recorded = new InMemoryTransitionLog();
        final int symptoms;

        Env(long redisMicros, long pgMicros) {
            this(redisMicros, pgMicros, false);
        }

        /** @param inMemory the in-memory stores instead of the fake Redis */
        Env(long redisMicros, long pgMicros, boolean inMemory) {
            redis = new FakeRedis(redisMicros);
            InMemoryCatalog store = new InMemoryCatalog();
            SymptomEvents events = new SymptomEvents(e -> CompletableFuture.completedFuture(e), store::findDefinition,
                    Clock.systemUTC());
            var samples = inMemory ? SignalSamples.inMemory() : SignalSamplesAccess.redis(redis.api(), Clock.systemUTC());
            DataSourceService sources = new DataSourceService(store, samples);
            AuditService audit = new AuditService(new InMemoryAuditStore());
            SymptomCatalogService catalog = new SymptomCatalogService(store, sources, audit);
            symptoms = publishTemplates(catalog, ORG, ACTIVE) + publishTemplates(catalog, OTHER, 1);
            EvaluatorCatalog evaluatorCatalog = new EvaluatorCatalog(catalog, sources);
            Holds holds = new HoldIndex(holdStore(pgMicros, holdQueries));
            TransitionLog log = slowLog(recorded, pgMicros, logAppends);
            Duration ttl = Duration.ofDays(7);
            EvaluatorStream.Stores stores = inMemory
                    ? new EvaluatorStream.Stores(new InMemoryEpisodeRepository(), new InMemoryDutyStore())
                    : new EvaluatorStream.Stores(new RedisEpisodes(redis.api(), ttl),
                            new RedisDutyStore(redis.api(), ttl), VehicleReads.redis(redis.mutiny()));
            SimpleMeterRegistry meters = new SimpleMeterRegistry();
            TripChecks checks = new TripChecks(evaluatorCatalog, stores.episodes(), log, events, audit, meters,
                    holds);
            LostSignalDetector detector = new LostSignalDetector(true,
                    inMemory ? new InMemoryLossStore() : new RedisLossStore(redis.mutiny(), ttl),
                    LossSettings.defaults(), TickerSettings.defaults(), checks, meters, Clock.systemUTC());
            stream = new EvaluatorStream(true, evaluatorCatalog, new EvaluatorStream.Sinks(log, events, meters),
                    Clock.systemUTC(), stores, samples, LateFrames.NONE, detector, holds);
        }

        void reset() {
            redis.resetCounts();
            holdQueries.set(0);
            logAppends.set(0);
        }
    }

    /** Publishes every platform template that validates: the first {@code active} ACTIVE, the rest TEST. */
    static int publishTemplates(SymptomCatalogService catalog, String tenant, int active) {
        int published = 0;
        for (SymptomTemplate t : SeedTemplates.all()) {
            try {
                var id = catalog.create(tenant, "bench@example.com", new CreateRequest(t.key(), t.name(), null, null,
                        null, t.spec().source(), null, t.spec())).definition().id();
                catalog.publish(tenant, "bench@example.com", id, "bench", null,
                        published < active ? SymptomState.ACTIVE : SymptomState.TEST);
                published++;
            } catch (RuntimeException e) {
                System.out.printf("template %s not published: %s%n", t.key(), e.getMessage());
            }
        }
        return published;
    }

    static HoldStore holdStore(long pgMicros, AtomicLong queries) {
        return new HoldStore() {
            @Override
            public List<IgnoreHold> open(String tenantCode) {
                queries.incrementAndGet();
                pause(pgMicros);
                return List.of();
            }

            @Override
            public List<IgnoreHold> open(int limit) {
                return List.of();
            }

            @Override
            public Optional<IgnoreHold> find(String tenantCode, String treatmentId) {
                return Optional.empty();
            }

            @Override
            public Optional<Boolean> tripLive(String tenantCode, String tripId, String assetId) {
                return Optional.empty();
            }
        };
    }

    static TransitionLog slowLog(InMemoryTransitionLog log, long pgMicros, AtomicLong appends) {
        return (tenant, transitions, place, context) -> {
            appends.incrementAndGet();
            pause(pgMicros);
            synchronized (log) {
                return log.append(tenant, transitions, place, context);
            }
        };
    }

    static void pause(long micros) {
        if (micros > 0) {
            LockSupport.parkNanos(micros * 1000);
        }
    }

    /** A vehicle's signal as the signal builder publishes it. */
    record Signal(String assetId, String json) {
    }

    /**
     * {@code count} signals of {@code vehicles} vehicles, 30 s apart per vehicle, in time order: 70% on a trip,
     * a speed above 90 km/h on 10% of the frames, a device event on 5%, and 20% shared with a second organization.
     */
    static List<Signal> signals(int vehicles, int count, Instant start, long seed) {
        Random r = new Random(seed);
        List<Signal> out = new ArrayList<>(count);
        double[] lat = new double[vehicles];
        double[] lon = new double[vehicles];
        for (int v = 0; v < vehicles; v++) {
            lat[v] = -33.4 + r.nextDouble();
            lon[v] = -70.6 + r.nextDouble();
        }
        for (int i = 0; i < count; i++) {
            int v = i % vehicles;
            Instant at = start.plusSeconds(30L * (i / vehicles)).plusMillis(v * 37L % 30_000);
            lat[v] += (r.nextDouble() - 0.5) * 0.004;
            lon[v] += (r.nextDouble() - 0.5) * 0.004;
            double speed = r.nextDouble() < 0.1 ? 95 + r.nextDouble() * 30 : r.nextDouble() * 80;
            boolean onTrip = v % 10 < 7;
            boolean shared = v % 5 == 0;
            String asset = "BENCH%04d".formatted(v);
            Map<String, Object> trip = onTrip ? trip(v, r) : Map.of("active", false, "double_driver", false);
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("schema", "miot.gps.signal@1");
            s.put("asset_id", asset);
            s.put("at", at.toString());
            s.put("received_at", at.plusMillis(800).toString());
            s.put("sender", "SENDER%02d".formatted(v % 7));
            s.put("clients", shared ? List.of(ORG, OTHER) : List.of(ORG));
            s.put("trips", shared ? Map.of(ORG, trip, OTHER, trip) : Map.of(ORG, trip));
            s.put("geos", Map.of(ORG, Map.of("authorized_zone", r.nextBoolean(), "risk_zone", r.nextDouble() < 0.05,
                    "outside_authorized", r.nextDouble() < 0.2)));
            s.put("roads", Map.of(ORG, Map.of("maxspeed_osm", 90.0, "maxspeed_custom", 80.0)));
            s.put("vehicle", Map.of("weight_category", "HEAVY", "weight_kg", 28000.0));
            s.put("local_hour", (at.getEpochSecond() / 3600) % 24);
            s.put("local_minutes", (double) ((at.getEpochSecond() / 60) % 1440));
            s.put("derived", Map.of("moving", speed > 3));
            Map<String, Object> frame = new LinkedHashMap<>();
            frame.put("asset_id", asset);
            frame.put("type", "TRUCK");
            frame.put("gps", Map.of("latitude", lat[v], "longitude", lon[v], "speed", speed, "heading", 90.0));
            frame.put("telecom", Map.of("operator", "ENTEL", "signal_strength", 24, "gps_provider", "GPS"));
            frame.put("sensors", Map.of("engine_status", speed > 1, "panic_button", false));
            frame.put("events", r.nextDouble() < 0.05 ? List.of(Map.of("event_type", "IGN_ON", "description",
                    "Encendido", "timestamp", at.toString())) : List.of());
            s.put("frame", frame);
            try {
                out.add(new Signal(asset, JSON.writeValueAsString(s)));
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }
        return out;
    }

    private static Map<String, Object> trip(int v, Random r) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("active", true);
        t.put("double_driver", v % 3 == 0);
        t.put("id", "00000000-0000-0000-0000-%012d".formatted(v));
        t.put("code", "SVC-" + v);
        t.put("status", "EN TRANSITO");
        t.put("age_min", 95.0);
        t.put("late_min", -10.0 + r.nextDouble() * 30);
        t.put("eta_deviation_min", -30.0 + r.nextDouble() * 60);
        t.put("origin", Map.of("id", 32, "label", "Planta", "visited", true, "internal", true));
        t.put("destination", Map.of("id", 17, "label", "Puerto", "visited", false));
        t.put("driver", Map.of("id", "drv-" + v, "registered", true, "status", "ACTIVE", "license_expired", false));
        return t;
    }

    /** Signals/s on one thread without latency, and that thread's CPU time per signal. */
    static void cpu(Env env, List<Signal> signals, String label) {
        ThreadMXBean mx = ManagementFactory.getThreadMXBean();
        long cpu0 = mx.getCurrentThreadCpuTime();
        long t0 = System.nanoTime();
        for (Signal s : signals) {
            env.stream.evaluate(s.json(), Instant.now());
        }
        long ns = System.nanoTime() - t0;
        long cpu = mx.getCurrentThreadCpuTime() - cpu0;
        System.out.printf("%s: %d signals, %.0f signals/s on one thread, %.3f ms CPU per signal (%.0f signals/s per"
                + " CPU)%n", label, signals.size(), signals.size() * 1e9 / ns, cpu / 1e6 / signals.size(),
                signals.size() * 1e9 / cpu);
    }

    /** Signals/s with latency, in {@code lanes} threads, each vehicle always in the same lane and in order. */
    static double lanes(Env env, List<Signal> signals, int lanes) throws Exception {
        List<List<Signal>> byLane = new ArrayList<>();
        for (int i = 0; i < lanes; i++) {
            byLane.add(new ArrayList<>());
        }
        signals.forEach(s -> byLane.get(Math.floorMod(s.assetId().hashCode(), lanes)).add(s));
        ExecutorService pool = Executors.newFixedThreadPool(lanes);
        long t0 = System.nanoTime();
        List<Future<?>> done = new ArrayList<>();
        for (List<Signal> lane : byLane) {
            done.add(pool.submit(() -> lane.forEach(s -> env.stream.evaluate(s.json(), Instant.now()))));
        }
        for (Future<?> f : done) {
            f.get();
        }
        long ns = System.nanoTime() - t0;
        pool.shutdown();
        return signals.size() * 1e9 / ns;
    }

    @Test
    void replaysSignalsThroughTheEvaluator() throws Exception {
        long redisMicros = Long.getLong("bench.redis-us", 2400);
        long pgMicros = Long.getLong("bench.pg-us", 2000);
        int latencySignals = Integer.getInteger("bench.signals", 3000);
        int lanes = Integer.getInteger("bench.lanes", 8);
        int vehicles = 400;
        Instant start = Instant.parse("2026-11-07T12:00:00Z");

        if (Boolean.parseBoolean(System.getProperty("bench.cpu", "true"))) {
            Env cpuEnv = new Env(0, 0);
            System.out.printf("symptoms published: %d (%d ACTIVE in %s)%n", cpuEnv.symptoms, ACTIVE, ORG);
            cpu(cpuEnv, signals(vehicles, 40_000, start, 1), "warm-up");
            List<Signal> measured = signals(vehicles, 60_000, start.plus(Duration.ofHours(2)), 2);
            cpuEnv.reset();
            String jfr = System.getProperty("bench.jfr");
            jdk.jfr.Recording recording = null;
            if (jfr != null) {
                recording = new jdk.jfr.Recording(jdk.jfr.Configuration.getConfiguration("profile"));
                recording.start();
            }
            cpu(cpuEnv, measured, "cpu");
            if (recording != null) {
                recording.stop();
                recording.dump(java.nio.file.Path.of(jfr));
                recording.close();
            }
            double n = measured.size();
            System.out.printf("per signal: %.2f Redis round trips, %.2f hold queries, %.3f log appends%n",
                    cpuEnv.redis.roundTrips() / n, cpuEnv.holdQueries.get() / n, cpuEnv.logAppends.get() / n);
            cpuEnv.redis.commands().forEach((k, v) -> System.out.printf("  %-24s %.2f per signal%n", k, v / n));
            cpuEnv.redis.close();
        }

        Env slow = new Env(redisMicros, pgMicros);
        lanes(slow, signals(vehicles, 2 * vehicles, start, 3), lanes);
        List<Signal> timed = signals(vehicles, latencySignals, start.plus(Duration.ofHours(1)), 4);
        double one = lanes(slow, timed.subList(0, Math.min(timed.size(), latencySignals / 3)), 1);
        double many = lanes(slow, signals(vehicles, latencySignals, start.plus(Duration.ofHours(3)), 5), lanes);
        System.out.printf("latency (Redis %d us, Postgres %d us): %.1f signals/s one at a time (%.1f ms each),"
                + " %.1f signals/s in %d vehicle lanes%n", redisMicros, pgMicros, one, 1000 / one, many, lanes);
        slow.redis.close();
        assertTrue(one > 0);
    }
}

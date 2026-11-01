package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.evaluator.EvaluatorRedis;
import com.microboxlabs.miot.symptoms.lostsignal.IngestHealth.Heartbeat;
import com.microboxlabs.miot.symptoms.lostsignal.LossStore.Schedule;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * The lost-signal detector. Every signal the evaluator reads updates the arrival profiles
 * ({@link ArrivalProfiles}) and, for a vehicle on a trip, moves its deadline to arrival + expected silence. A
 * ticker in one replica checks the vehicles whose deadline expired ({@link LossTicker}). Off unless
 * {@code miot.symptoms.lost-signal.enabled}; a failure is counted ({@code miot.symptoms.lost_signal.failed}) and
 * never redelivers the signal.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class LostSignalDetector {

    private static final Logger LOG = Logger.getLogger(LostSignalDetector.class);
    private static final Duration HEARTBEAT_EVERY = Duration.ofSeconds(1);

    private final boolean enabled;
    private final ArrivalProfiles profiles;
    private final LossStore store;
    private final LossTicker ticker;
    private final String owner;
    private final MeterRegistry meters;
    private final Clock clock;
    private final AtomicLong lastBeat = new AtomicLong();

    /** How the ticker runs. */
    public record TickerSettings(Duration recheck, Duration maxSilence, Duration leaseTtl, int batch,
            IngestHealth ingest) {

        public static TickerSettings defaults() {
            return new TickerSettings(Duration.ofMinutes(1), Duration.ofDays(1), Duration.ofSeconds(15), 500,
                    new IngestHealth(Duration.ofMinutes(2), Duration.ofMinutes(2)));
        }
    }

    @Inject
    LostSignalDetector(@ConfigProperty(name = "miot.symptoms.lost-signal.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.lost-signal.profile-ttl", defaultValue = "P7D") Duration profileTtl,
            @ConfigProperty(name = "miot.symptoms.lost-signal.min-samples", defaultValue = "20") int minSamples,
            @ConfigProperty(name = "miot.symptoms.lost-signal.gap-margin", defaultValue = "1.5") double gapMargin,
            @ConfigProperty(name = "miot.symptoms.lost-signal.delay-quantile", defaultValue = "0.9") double delayQuantile,
            @ConfigProperty(name = "miot.symptoms.lost-signal.max-delay", defaultValue = "PT1H") Duration maxDelay,
            @ConfigProperty(name = "miot.symptoms.lost-signal.recheck-every", defaultValue = "PT1M") Duration recheck,
            @ConfigProperty(name = "miot.symptoms.lost-signal.max-silence", defaultValue = "P1D") Duration maxSilence,
            @ConfigProperty(name = "miot.symptoms.lost-signal.ingest-stale-after", defaultValue = "PT2M") Duration staleAfter,
            @ConfigProperty(name = "miot.symptoms.lost-signal.ingest-max-lag", defaultValue = "PT2M") Duration maxLag,
            EvaluatorRedis redis, MeterRegistry meters) {
        this(enabled, redis.client().<LossStore>map(c -> new RedisLossStore(c, profileTtl))
                .orElseGet(InMemoryLossStore::new),
                settings(profileTtl, minSamples, gapMargin, delayQuantile, maxDelay),
                new TickerSettings(recheck, maxSilence, Duration.ofSeconds(15), 500,
                        new IngestHealth(staleAfter, maxLag)),
                meters, Clock.systemUTC());
        if (enabled) {
            LOG.infof("Lost-signal detector: on, state in %s", redis.client().isPresent() ? "Redis" : "memory");
        }
    }

    private static LossSettings settings(Duration profileTtl, int minSamples, double gapMargin, double delayQuantile,
            Duration maxDelay) {
        LossSettings d = LossSettings.defaults();
        return new LossSettings(profileTtl, d.vehicleMemory(), d.senderMemory(), minSamples, d.gapQuantile(),
                gapMargin, d.defaultGap(), d.minGap(), delayQuantile, d.defaultDelay(), maxDelay);
    }

    public LostSignalDetector(boolean enabled, LossStore store, LossSettings settings, TickerSettings ticker,
            MeterRegistry meters, Clock clock) {
        this.enabled = enabled;
        this.store = store;
        this.profiles = new ArrivalProfiles(store, settings);
        this.owner = UUID.randomUUID().toString();
        this.meters = meters;
        this.clock = clock;
        this.ticker = new LossTicker(store, new MarkLost(store, ticker.recheck(), ticker.maxSilence(), meters),
                ticker.ingest(), owner, ticker.leaseTtl(), ticker.batch(), meters, clock);
    }

    /** A detector that does nothing. */
    public static LostSignalDetector off() {
        return new LostSignalDetector(false, new InMemoryLossStore(), LossSettings.defaults(),
                TickerSettings.defaults(), new SimpleMeterRegistry(), Clock.systemUTC());
    }

    /**
     * One signal the evaluator read, on time or late.
     *
     * @param arrivedAt when it reached the platform
     */
    public void frame(String assetId, Instant at, Instant arrivedAt, Map<String, Object> signal) {
        if (!enabled) {
            return;
        }
        try {
            record(Frame.of(signal, assetId, at, arrivedAt), signal);
            beat(arrivedAt);
        } catch (RuntimeException e) {
            meters.counter("miot.symptoms.lost_signal.failed").increment();
            LOG.debugf("Lost-signal detector: frame not recorded (%s)", e.getClass().getSimpleName());
        }
    }

    private void record(Frame f, Map<String, Object> signal) {
        LossStore.Profiles before = store.load(f.assetId(), f.sender());
        ArrivalProfiles.Arrival a = profiles.apply(before, f);
        store.save(f.assetId(), a.vehicle(), f.sender(), a.sender(), schedule(a, before.check(), f, signal));
    }

    /**
     * A late frame or a replay leaves the deadline; off every trip there is none. Otherwise the deadline is the
     * newest frame's arrival plus the expected silence, or now for a lost vehicle, so its return is checked on the
     * next tick.
     */
    static Schedule schedule(ArrivalProfiles.Arrival a, CheckState check, Frame f, Map<String, Object> signal) {
        if (a.late() || a.replay()) {
            return Schedule.KEEP;
        }
        Map<String, Map<String, Object>> trips = activeTrips(signal);
        boolean lost = check != null && check.lost();
        if (trips.isEmpty()) {
            // A lost vehicle off its trips gets one more check, which clears its state.
            return lost ? Schedule.clear(f.arrivedAt()) : Schedule.DROP;
        }
        Instant deadline = lost ? f.arrivedAt()
                : a.vehicle().arrival().plus(a.expected());
        return Schedule.at(deadline, new Watch(trips, a.expected().toSeconds(), f.sender()));
    }

    @SuppressWarnings("unchecked")
    static Map<String, Map<String, Object>> activeTrips(Map<String, Object> signal) {
        Map<String, Map<String, Object>> out = new LinkedHashMap<>();
        if (signal.get("trips") instanceof Map<?, ?> byClient) {
            byClient.forEach((tenant, trip) -> {
                if (tenant instanceof String t && trip instanceof Map<?, ?> m && Boolean.TRUE.equals(m.get("active"))) {
                    out.put(t, (Map<String, Object>) m);
                }
            });
        }
        return out;
    }

    /** At most one heartbeat per second per replica: when it read a signal and how far behind its publish time. */
    private void beat(Instant arrivedAt) {
        Instant now = clock.instant();
        long last = lastBeat.get();
        if (now.toEpochMilli() - last < HEARTBEAT_EVERY.toMillis() || !lastBeat.compareAndSet(last, now.toEpochMilli())) {
            return;
        }
        Duration lag = Duration.between(arrivedAt, now);
        store.heartbeat(new Heartbeat(owner, now, lag.isNegative() ? Duration.ZERO : lag));
    }

    @Scheduled(every = "${miot.symptoms.lost-signal.tick-every:5s}", delayed = "30s",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduledTick() {
        if (!enabled) {
            return;
        }
        try {
            tick();
        } catch (RuntimeException e) {
            // The deadlines stay: the next tick takes them.
            LOG.warnf("Lost-signal ticker: tick failed (%s)", e.getClass().getSimpleName());
        }
    }

    /** One pass of the ticker; returns the vehicles checked. */
    public int tick() {
        return ticker.tick();
    }
}

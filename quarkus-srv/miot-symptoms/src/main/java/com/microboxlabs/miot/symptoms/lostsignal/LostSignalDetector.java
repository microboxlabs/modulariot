package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.core.gps.SignalStates;
import com.microboxlabs.miot.symptoms.evaluator.EpisodeRepository;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorCatalog;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorRedis;
import com.microboxlabs.miot.symptoms.evaluator.InMemoryEpisodeRepository;
import com.microboxlabs.miot.symptoms.evaluator.RedisEpisodes;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.lostsignal.IngestHealth.Heartbeat;
import com.microboxlabs.miot.symptoms.lostsignal.LossStore.Mark;
import com.microboxlabs.miot.symptoms.lostsignal.LossStore.Schedule;
import com.microboxlabs.miot.symptoms.service.AuditService;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.eclipse.microprofile.config.ConfigProvider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * The lost-signal detector. Every signal the evaluator reads updates the arrival profiles
 * ({@link ArrivalProfiles}) and, for a vehicle on a trip, moves its deadline to arrival + expected silence. A
 * ticker in one replica checks the vehicles whose deadline expired ({@link LossTicker}) and runs the
 * organizations' {@code trip_check} versions on them ({@link TripChecks}). On wherever the evaluator is; a
 * failure is counted ({@code miot.symptoms.lost_signal.failed}) and never redelivers the signal. It also answers
 * the vehicles' signal state from the same profiles ({@link SignalStateReader}), on any replica with the store.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class LostSignalDetector implements SignalStates {

    private static final Logger LOG = Logger.getLogger(LostSignalDetector.class);
    private static final Duration HEARTBEAT_EVERY = Duration.ofSeconds(1);
    /** A frame from inside the silence this much later than it was taken, or the sender's usual delay, is backfill. */
    static final Duration BACKFILL_DELAY = Duration.ofMinutes(2);
    /** After a failed frame the detector skips frames this long, so a stalled store does not hold the consumer. */
    static final long BACKOFF_MS = 30_000;

    private final boolean enabled;
    private final ArrivalProfiles profiles;
    private final LossStore store;
    private final LossTicker ticker;
    private final TripChecks trips;
    private final ShadowMaps coverage;
    private final String owner;
    private final MeterRegistry meters;
    private final Clock clock;
    private final AtomicLong lastBeat = new AtomicLong();
    private final SignalStateReader signals;

    /**
     * How the ticker runs.
     *
     * @param returnGrace how long a return without backfill waits for it before its check
     */
    public record TickerSettings(Duration recheck, Duration maxSilence, Duration leaseTtl, int batch,
            IngestHealth ingest, Duration returnGrace) {

        public static TickerSettings defaults() {
            return new TickerSettings(Duration.ofMinutes(1), Duration.ofDays(1), Duration.ofSeconds(15), 500,
                    new IngestHealth(Duration.ofMinutes(2), Duration.ofMinutes(2)), Duration.ofMinutes(1));
        }
    }

    /** Whether the detector runs and the settings of its arrival profiles and ticker. */
    public record Settings(boolean enabled, LossSettings profiles, TickerSettings ticker) {
    }

    private volatile long skipUntil;

    @Inject
    LostSignalDetector(@ConfigProperty(name = "miot.symptoms.evaluator.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.lost-signal.profile-ttl", defaultValue = "P7D") Duration profileTtl,
            @ConfigProperty(name = "miot.symptoms.lost-signal.min-samples", defaultValue = "20") int minSamples,
            @ConfigProperty(name = "miot.symptoms.lost-signal.gap-margin", defaultValue = "1.5") double gapMargin,
            @ConfigProperty(name = "miot.symptoms.lost-signal.delay-quantile", defaultValue = "0.9") double delayQuantile,
            @ConfigProperty(name = "miot.symptoms.lost-signal.max-delay", defaultValue = "PT1H") Duration maxDelay,
            @ConfigProperty(name = "miot.symptoms.lost-signal.recheck-every", defaultValue = "PT1M") Duration recheck,
            @ConfigProperty(name = "miot.symptoms.lost-signal.max-silence", defaultValue = "P1D") Duration maxSilence,
            @ConfigProperty(name = "miot.symptoms.lost-signal.ingest-stale-after", defaultValue = "PT2M") Duration staleAfter,
            @ConfigProperty(name = "miot.symptoms.lost-signal.ingest-max-lag", defaultValue = "PT2M") Duration maxLag,
            @ConfigProperty(name = "miot.symptoms.lost-signal.return-grace", defaultValue = "PT1M") Duration returnGrace,
            @ConfigProperty(name = "miot.symptoms.evaluator.episode-ttl", defaultValue = "P7D") Duration episodeTtl,
            EvaluatorRedis redis, EvaluatorCatalog catalog, TransitionLog transitionLog, SymptomEvents events,
            AuditService audit, MeterRegistry meters, Instance<Pool> pool) {
        this(new Settings(enabled, settings(profileTtl, minSamples, gapMargin, delayQuantile, maxDelay),
                new TickerSettings(recheck, maxSilence, Duration.ofSeconds(15), 500,
                        new IngestHealth(staleAfter, maxLag), returnGrace)),
                redis.client().<LossStore>map(c -> new RedisLossStore(c, profileTtl))
                        .orElseGet(InMemoryLossStore::new),
                // The evaluator's episodes: an operator's close drops them for both.
                new TripChecks(catalog, redis.api().<EpisodeRepository>map(api -> new RedisEpisodes(api, episodeTtl))
                        .orElseGet(InMemoryEpisodeRepository::new), transitionLog, events, audit, meters),
                new ShadowMaps(new PgCoverageStore(pool::get), CoverageSettings.from(ConfigProvider.getConfig()),
                        Clock.systemUTC()),
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
            TripChecks trips, MeterRegistry meters, Clock clock) {
        this(new Settings(enabled, settings, ticker), store, trips, ShadowMaps.of(ShadowMap.empty()), meters, clock);
    }

    public LostSignalDetector(Settings settings, LossStore store, TripChecks trips, ShadowMaps coverage,
            MeterRegistry meters, Clock clock) {
        this.enabled = settings.enabled();
        this.coverage = coverage;
        meters.gauge("miot.symptoms.lost_signal.coverage_cells", coverage, m -> m.get().cells());
        this.trips = trips;
        this.store = store;
        this.profiles = new ArrivalProfiles(store, settings.profiles());
        this.signals = new SignalStateReader(store, profiles);
        this.owner = UUID.randomUUID().toString();
        this.meters = meters;
        this.clock = clock;
        TickerSettings tickerSettings = settings.ticker();
        this.ticker = new LossTicker(store, new MarkLost(store, trips, coverage, tickerSettings.recheck(),
                tickerSettings.maxSilence(), tickerSettings.returnGrace(), meters), tickerSettings.ingest(), owner,
                tickerSettings.leaseTtl(), tickerSettings.batch(), meters, clock);
    }

    /** A detector that does nothing. */
    public static LostSignalDetector off() {
        return new LostSignalDetector(false, new InMemoryLossStore(), LossSettings.defaults(),
                TickerSettings.defaults(), null, new SimpleMeterRegistry(), Clock.systemUTC());
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
        if (System.currentTimeMillis() < skipUntil) {
            meters.counter("miot.symptoms.lost_signal.skipped").increment();
            return;
        }
        try {
            observe(Frame.of(signal, assetId, at, arrivedAt), signal);
            beat(arrivedAt);
        } catch (RuntimeException e) {
            skipUntil = System.currentTimeMillis() + BACKOFF_MS;
            meters.counter("miot.symptoms.lost_signal.failed").increment();
            LOG.debugf("Lost-signal detector: frame not recorded (%s)", e.getClass().getSimpleName());
        }
    }

    private void observe(Frame f, Map<String, Object> signal) {
        LossStore.Profiles before = store.load(f.assetId(), f.sender());
        ArrivalProfiles.Arrival a = profiles.apply(before, f);
        store.save(f.assetId(), a.vehicle(), f.sender(), a.sender(), schedule(a, before.check(), f, signal),
                mark(a, before.check(), f, profiles.settings()), reporting(a, f));
    }

    /** Only a frame newer than the vehicle's newest, with a position, counts the vehicle as reporting there. */
    static LossStore.Reporting reporting(ArrivalProfiles.Arrival a, Frame f) {
        if (a.late() || a.replay() || CoverageMap.cell(f.latitude(), f.longitude()) == null) {
            return null;
        }
        return new LossStore.Reporting(f.latitude(), f.longitude());
    }

    /**
     * For a lost vehicle, a frame from inside the silence: the first one on time is its return, and one that
     * arrives late or delayed past {@link #BACKFILL_DELAY} and the sender's usual delay is backfill.
     */
    static Mark mark(ArrivalProfiles.Arrival a, CheckState check, Frame f, LossSettings settings) {
        if (check == null || !check.lost() || !f.at().isAfter(check.lostSince())) {
            return null;
        }
        Duration usual = a.sender().deliveryDelay(settings);
        double backfillAfter = (double) Math.max(BACKFILL_DELAY.toSeconds(), usual.toSeconds());
        boolean backfill = a.late() || f.delaySeconds() > backfillAfter;
        Instant returned = a.late() || a.replay() ? null : f.arrivedAt();
        return backfill || returned != null ? new Mark(check.lostSince(), returned, backfill) : null;
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
            return lost ? Schedule.clear(f.arrivedAt(), new Watch(Map.of(), a.expected().toSeconds(), f.sender()))
                    : Schedule.DROP;
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

    /** Every replica keeps the shadow map in memory and rebuilds it from the coverage rows. */
    @Scheduled(every = "${miot.symptoms.lost-signal.coverage.reload-every:1h}", delayed = "20s",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void reloadCoverage() {
        if (!enabled) {
            return;
        }
        try {
            int cells = coverage.reload();
            LOG.debugf("Lost-signal detector: shadow map has %d cells", cells);
        } catch (RuntimeException e) {
            // The previous map stays.
            LOG.warnf("Lost-signal detector: shadow map not reloaded (%s)", e.getClass().getSimpleName());
        }
    }

    /** An operator closed the symptom's case for the vehicle. */
    public void forget(String tenant, String assetId, UUID definitionId) {
        if (enabled) {
            trips.forget(tenant, assetId, definitionId);
        }
    }

    /** Read whether the detector runs here or not: the profiles are shared through the store. */
    @Override
    public Map<String, SignalState> states(Collection<String> assetIds, Instant now) {
        return signals.states(assetIds, now);
    }

    /** One pass of the ticker; returns the vehicles checked. */
    public int tick() {
        return ticker.tick();
    }
}

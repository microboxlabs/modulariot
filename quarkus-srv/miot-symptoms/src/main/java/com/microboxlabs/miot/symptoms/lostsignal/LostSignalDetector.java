package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.evaluator.EvaluatorRedis;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * The lost-signal detector's side of the GPS signal stream: every signal the evaluator reads updates the arrival
 * profiles ({@link ArrivalProfiles}). Off unless {@code miot.symptoms.lost-signal.enabled}; a failure is counted
 * ({@code miot.symptoms.lost_signal.failed}) and never redelivers the signal.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class LostSignalDetector {

    private static final Logger LOG = Logger.getLogger(LostSignalDetector.class);
    /** After a failed frame the detector skips frames this long, so a stalled store does not hold the consumer. */
    static final long BACKOFF_MS = 30_000;

    private final boolean enabled;
    private final ArrivalProfiles profiles;
    private final MeterRegistry meters;
    private volatile long skipUntil;

    @Inject
    LostSignalDetector(@ConfigProperty(name = "miot.symptoms.lost-signal.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.lost-signal.profile-ttl", defaultValue = "P7D") Duration profileTtl,
            @ConfigProperty(name = "miot.symptoms.lost-signal.min-samples", defaultValue = "20") int minSamples,
            @ConfigProperty(name = "miot.symptoms.lost-signal.gap-margin", defaultValue = "1.5") double gapMargin,
            @ConfigProperty(name = "miot.symptoms.lost-signal.delay-quantile", defaultValue = "0.9") double delayQuantile,
            @ConfigProperty(name = "miot.symptoms.lost-signal.max-delay", defaultValue = "PT1H") Duration maxDelay,
            EvaluatorRedis redis, MeterRegistry meters) {
        this(enabled, new ArrivalProfiles(redis.client().<LossStore>map(c -> new RedisLossStore(c, profileTtl))
                .orElseGet(InMemoryLossStore::new),
                settings(profileTtl, minSamples, gapMargin, delayQuantile, maxDelay)), meters);
        if (enabled) {
            LOG.infof("Lost-signal detector: on, profiles in %s", redis.client().isPresent() ? "Redis" : "memory");
        }
    }

    private static LossSettings settings(Duration profileTtl, int minSamples, double gapMargin, double delayQuantile,
            Duration maxDelay) {
        LossSettings d = LossSettings.defaults();
        return new LossSettings(profileTtl, d.vehicleMemory(), d.senderMemory(), minSamples, d.gapQuantile(),
                gapMargin, d.defaultGap(), d.minGap(), delayQuantile, d.defaultDelay(), maxDelay);
    }

    public LostSignalDetector(boolean enabled, ArrivalProfiles profiles, MeterRegistry meters) {
        this.enabled = enabled;
        this.profiles = profiles;
        this.meters = meters;
    }

    /** A detector that does nothing. */
    public static LostSignalDetector off() {
        return new LostSignalDetector(false, null, new SimpleMeterRegistry());
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
            profiles.observe(Frame.of(signal, assetId, at, arrivedAt));
        } catch (RuntimeException e) {
            skipUntil = System.currentTimeMillis() + BACKOFF_MS;
            meters.counter("miot.symptoms.lost_signal.failed").increment();
            LOG.debugf("Lost-signal detector: frame not recorded (%s)", e.getClass().getSimpleName());
        }
    }
}

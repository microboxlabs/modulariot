package com.microboxlabs.miot.symptoms.evaluator;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.signal.SignalFields;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.common.annotation.Blocking;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.jboss.logging.Logger;

/**
 * Runs the published symptom versions on each GPS signal ({@code gps-signals-in},
 * {@code miot.gps.signal@1}) for every organization the vehicle belongs to,
 * keeps the episodes in Redis (in memory when no Redis URL is set), records
 * the case changes in {@code miot_symptoms.signal_transitions}, publishes each new
 * one as a {@code symptom.case.*} event ({@link SymptomEvents}) and keeps
 * recent signals for rule previews ({@link SignalSamples}). On wherever the
 * symptoms Pulsar is wired ({@code miot.symptoms.evaluator.enabled}).
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class EvaluatorStream {

    private static final Logger LOG = Logger.getLogger(EvaluatorStream.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    static final String SOURCE = "gps_signal";
    private static final Duration VERSIONS_TTL = Duration.ofSeconds(30);

    private final boolean enabled;
    private final EvaluatorCatalog catalog;
    private final TransitionLog transitionLog;
    private final MeterRegistry meters;
    private final Clock clock;
    private final EpisodeRepository episodes;
    private final SignalSamples samples;
    private final SymptomEvents events;
    private final Map<String, Cached> versions = new ConcurrentHashMap<>();

    private record Cached(Instant at, List<CompiledSymptom> symptoms) {
    }

    @Inject
    EvaluatorStream(@ConfigProperty(name = "miot.symptoms.evaluator.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.evaluator.episode-ttl", defaultValue = "P7D") Duration ttl,
            EvaluatorRedis redis, SignalSamples samples, EvaluatorCatalog catalog, TransitionLog transitionLog,
            MeterRegistry meters, SymptomEvents events) {
        this(enabled, catalog, new Sinks(transitionLog, events, meters), Clock.systemUTC(),
                // Also when not consuming: closing a case drops its episode in the Redis the consumers use.
                redis.api().<EpisodeRepository>map(api -> new RedisEpisodes(api, ttl))
                        .orElseGet(InMemoryEpisodeRepository::new),
                samples);
        if (enabled) {
            LOG.infof("Symptom evaluator: on, episodes in %s",
                    episodes instanceof RedisEpisodes ? "Redis" : "memory");
        }
    }

    /** Where the evaluator writes: the transition log, the case events and the metrics. */
    record Sinks(TransitionLog transitionLog, SymptomEvents events, MeterRegistry meters) {
    }

    EvaluatorStream(boolean enabled, EvaluatorCatalog catalog, Sinks sinks, Clock clock, EpisodeRepository episodes,
            SignalSamples samples) {
        this.enabled = enabled;
        this.catalog = catalog;
        this.transitionLog = sinks.transitionLog();
        this.events = sinks.events();
        this.meters = sinks.meters();
        this.clock = clock;
        this.episodes = episodes;
        this.samples = samples;
    }

    @Incoming("gps-signals-in")
    @Blocking
    public CompletionStage<Void> onSignal(Message<byte[]> in) {
        try {
            evaluate(new String(in.getPayload(), StandardCharsets.UTF_8));
        } catch (IllegalArgumentException e) {
            meters.counter("miot.symptoms.evaluator.failed").increment();
            LOG.warnf("Symptom evaluator: signal skipped (%s)", e.getClass().getSimpleName());
        } catch (RuntimeException e) {
            // Redis, the catalog or the transition log failed: redelivered, and organizations already
            // evaluated reject the replay by their watermark.
            meters.counter("miot.symptoms.evaluator.retried").increment();
            LOG.warnf("Symptom evaluator: signal retried (%s)", e.getClass().getSimpleName());
            return in.nack(e);
        }
        return in.ack();
    }

    /** Evaluates one signal for every organization it belongs to; returns the transitions recorded. */
    int evaluate(String json) {
        if (!enabled) {
            return 0;
        }
        Map<String, Object> signal;
        try {
            signal = JSON.readValue(json, new TypeReference<>() {
            });
        } catch (Exception e) {
            throw new IllegalArgumentException("not a signal", e);
        }
        Object asset = signal.get("asset_id");
        Object at = signal.get("at");
        if (!(asset instanceof String assetId) || !(at instanceof String time)
                || !(signal.get("clients") instanceof List<?> clients)) {
            return 0;
        }
        Instant instant;
        try {
            instant = Instant.parse(time);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("not a signal time", e);
        }
        int recorded = 0;
        for (Object client : clients) {
            if (client instanceof String tenant) {
                recorded += evaluate(tenant, assetId, instant, forTenant(signal, tenant));
            }
        }
        return recorded;
    }

    private static final Map<String, Object> NO_TRIP = Map.of("active", false, "double_driver", false);

    /** The signal as the organization's rules read it: its own trip as {@code trip}, none of the others. */
    static Map<String, Object> forTenant(Map<String, Object> signal, String tenant) {
        Map<String, Object> out = new LinkedHashMap<>(signal);
        Object trips = out.remove("trips");
        Object trip = trips instanceof Map<?, ?> byClient ? byClient.get(tenant) : null;
        out.put("trip", trip != null ? trip : NO_TRIP);
        return out;
    }

    private int evaluate(String tenant, String assetId, Instant at, Map<String, Object> signal) {
        samples.keep(tenant, signal);
        List<CompiledSymptom> symptoms = symptoms(tenant);
        if (symptoms.isEmpty()) {
            return 0;
        }
        AssetEpisodes state = episodes.load(tenant, assetId);
        SignalEvaluator.Result result = new SignalEvaluator(state)
                .evaluate(tenant, assetId, at, Map.of(SignalFields.ROOT, signal), symptoms);
        // Transitions first: a failed episode write replays the signal, and the log skips what it already holds.
        if (!result.transitions().isEmpty()) {
            TransitionLog.Place place = place(signal);
            // Only the changes new to the log: a replayed signal publishes nothing twice.
            events.transitions(tenant, transitionLog.append(tenant, result.transitions(), place), place);
        }
        episodes.save(state);
        result.transitions().forEach(t -> meters.counter("miot.symptoms.evaluator.transitions",
                "kind", t.kind().name(), "state", t.state().name()).increment());
        if (!result.errors().isEmpty()) {
            meters.counter("miot.symptoms.evaluator.rule_errors").increment(result.errors().size());
        }
        return result.transitions().size();
    }

    /**
     * An operator closed the symptom's case for the vehicle: its episode is dropped, so the next signal that
     * meets the condition opens a new case.
     */
    public void forget(String tenant, String assetId, java.util.UUID definitionId) {
        episodes.forget(tenant, assetId, definitionId);
    }

    /** The trip, position and driver of the signal, as far as it has them. */
    static TransitionLog.Place place(Map<String, Object> signal) {
        return new TransitionLog.Place(text(path(signal, "trip", "id")),
                number(path(signal, "frame", "gps", "latitude")), number(path(signal, "frame", "gps", "longitude")),
                number(path(signal, "frame", "gps", "speed")), text(path(signal, "trip", "driver", "id")));
    }

    private static String text(Object value) {
        return value instanceof String s ? s : null;
    }

    private static Object path(Map<String, Object> root, String... keys) {
        Object node = root;
        for (String k : keys) {
            node = node instanceof Map<?, ?> m ? m.get(k) : null;
        }
        return node;
    }

    private static Double number(Object value) {
        return value instanceof Number n ? n.doubleValue() : null;
    }

    private List<CompiledSymptom> symptoms(String tenant) {
        Instant now = clock.instant();
        Cached c = versions.get(tenant);
        if (c == null || c.at().plus(VERSIONS_TTL).isBefore(now)) {
            EvaluatorCatalog.Versions v = catalog.forSource(tenant, SOURCE);
            v.skipped().forEach(s -> LOG.debugf("Symptom evaluator: %s %s skipped: %s", s.definitionId(),
                    s.version(), s.reason()));
            c = new Cached(now, v.symptoms());
            versions.put(tenant, c);
        }
        return c.symptoms();
    }
}

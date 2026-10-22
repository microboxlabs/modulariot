package com.microboxlabs.miot.symptoms.evaluator;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.signal.SignalFields;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.common.annotation.Blocking;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.redis.client.Redis;
import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.redis.client.RedisOptions;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.jboss.logging.Logger;

/**
 * Runs the published symptom versions on each GPS signal ({@code gps-signals-in},
 * {@code miot.gps.signal@1}) for the organizations in
 * {@code miot.symptoms.evaluator.tenants} that the vehicle belongs to, keeps
 * the episodes in Redis (in memory when no Redis URL is set) and records the
 * case changes in {@code miot_symptoms.signal_transitions}. Off unless
 * {@code miot.symptoms.evaluator.enabled}. It opens no cases yet: ACTIVE
 * transitions are recorded like TEST ones.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class EvaluatorStream {

    private static final Logger LOG = Logger.getLogger(EvaluatorStream.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    static final String SOURCE = "gps_signal";
    private static final Duration VERSIONS_TTL = Duration.ofSeconds(30);

    private final boolean enabled;
    private final Set<String> tenants;
    private final EvaluatorCatalog catalog;
    private final TransitionLog log;
    private final MeterRegistry meters;
    private final Clock clock;
    private final EpisodeRepository episodes;
    private final Map<String, Cached> versions = new ConcurrentHashMap<>();

    private record Cached(Instant at, List<CompiledSymptom> symptoms) {
    }

    @Inject
    EvaluatorStream(@ConfigProperty(name = "miot.symptoms.evaluator.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.evaluator.tenants") Optional<List<String>> tenants,
            @ConfigProperty(name = "miot.symptoms.evaluator.redis-url") Optional<String> redisUrl,
            @ConfigProperty(name = "miot.symptoms.evaluator.episode-ttl", defaultValue = "P7D") Duration ttl,
            EvaluatorCatalog catalog, TransitionLog log, MeterRegistry meters, Vertx vertx) {
        this(enabled, Set.copyOf(tenants.orElse(List.of())), catalog, log, meters, Clock.systemUTC(),
                enabled && redisUrl.filter(u -> !u.isBlank()).isPresent()
                        ? new RedisEpisodes(RedisAPI.api(Redis.createClient(vertx,
                                new RedisOptions().setConnectionString(redisUrl.get()))), ttl)
                        : new InMemoryEpisodeRepository());
        if (enabled) {
            LOG.infof("Symptom evaluator: on for %d organizations, episodes in %s", this.tenants.size(),
                    episodes instanceof RedisEpisodes ? "Redis" : "memory");
        }
    }

    EvaluatorStream(boolean enabled, Set<String> tenants, EvaluatorCatalog catalog, TransitionLog log,
            MeterRegistry meters, Clock clock, EpisodeRepository episodes) {
        this.enabled = enabled;
        this.tenants = tenants;
        this.catalog = catalog;
        this.log = log;
        this.meters = meters;
        this.clock = clock;
        this.episodes = episodes;
    }

    @Incoming("gps-signals-in")
    @Blocking
    public CompletionStage<Void> onSignal(Message<byte[]> in) {
        try {
            evaluate(new String(in.getPayload(), StandardCharsets.UTF_8));
        } catch (RuntimeException e) {
            meters.counter("miot.symptoms.evaluator.failed").increment();
            LOG.warnf("Symptom evaluator: signal skipped (%s)", e.getClass().getSimpleName());
        }
        return in.ack();
    }

    /** Evaluates one signal for every allowed organization it belongs to; returns the transitions recorded. */
    int evaluate(String json) {
        if (!enabled || tenants.isEmpty()) {
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
        int recorded = 0;
        for (Object client : clients) {
            if (client instanceof String tenant && tenants.contains(tenant)) {
                recorded += evaluate(tenant, assetId, Instant.parse(time), signal);
            }
        }
        return recorded;
    }

    private int evaluate(String tenant, String assetId, Instant at, Map<String, Object> signal) {
        List<CompiledSymptom> symptoms = symptoms(tenant);
        if (symptoms.isEmpty()) {
            return 0;
        }
        AssetEpisodes state = episodes.load(tenant, assetId);
        SignalEvaluator.Result result = new SignalEvaluator(state)
                .evaluate(tenant, assetId, at, Map.of(SignalFields.ROOT, signal), symptoms);
        episodes.save(state);
        if (!result.transitions().isEmpty()) {
            log.record(tenant, result.transitions());
        }
        result.transitions().forEach(t -> meters.counter("miot.symptoms.evaluator.transitions",
                "kind", t.kind().name(), "state", t.state().name()).increment());
        if (!result.errors().isEmpty()) {
            meters.counter("miot.symptoms.evaluator.rule_errors").increment(result.errors().size());
        }
        return result.transitions().size();
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

package com.microboxlabs.miot.symptoms.evaluator;

import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.redis.client.Redis;
import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.redis.client.RedisOptions;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Duration;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * The Redis client of {@code miot.symptoms.evaluator.redis-url}, or none when it is not set. The pool has
 * {@code redis-pool-size} connections and queues up to {@code redis-pool-waiting} requests: the signal consumer's
 * concurrent vehicles each send several reads at once.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class EvaluatorRedis {

    private final Redis client;
    private final RedisAPI api;
    private EpisodeRepository episodes;

    EvaluatorRedis(@ConfigProperty(name = "miot.symptoms.evaluator.redis-url") Optional<String> url,
            @ConfigProperty(name = "miot.symptoms.evaluator.redis-pool-size", defaultValue = "16") int poolSize,
            @ConfigProperty(name = "miot.symptoms.evaluator.redis-pool-waiting", defaultValue = "256") int waiting,
            Vertx vertx) {
        this.client = url.filter(u -> !u.isBlank())
                .map(u -> Redis.createClient(vertx, new RedisOptions().setConnectionString(u)
                        .setMaxPoolSize(poolSize).setMaxPoolWaiting(waiting)))
                .orElse(null);
        this.api = client == null ? null : RedisAPI.api(client);
    }

    public Optional<RedisAPI> api() {
        return Optional.ofNullable(api);
    }

    /** The client itself, for pipelined batches. */
    public Optional<Redis> client() {
        return Optional.ofNullable(client);
    }

    /** Both consumers share the process-local fallback as well as the Redis episode keys. */
    public synchronized EpisodeRepository episodes(Duration ttl) {
        if (episodes == null) {
            episodes = api == null ? new InMemoryEpisodeRepository() : new RedisEpisodes(api, ttl);
        }
        return episodes;
    }
}

package com.microboxlabs.miot.symptoms.evaluator;

import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.redis.client.Redis;
import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.redis.client.RedisOptions;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** The Redis client of {@code miot.symptoms.evaluator.redis-url}, or none when it is not set. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class EvaluatorRedis {

    private final RedisAPI api;

    EvaluatorRedis(@ConfigProperty(name = "miot.symptoms.evaluator.redis-url") Optional<String> url, Vertx vertx) {
        this.api = url.filter(u -> !u.isBlank())
                .map(u -> RedisAPI.api(Redis.createClient(vertx, new RedisOptions().setConnectionString(u))))
                .orElse(null);
    }

    public Optional<RedisAPI> api() {
        return Optional.ofNullable(api);
    }
}

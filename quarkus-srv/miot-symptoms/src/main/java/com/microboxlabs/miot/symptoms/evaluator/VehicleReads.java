package com.microboxlabs.miot.symptoms.evaluator;

import com.microboxlabs.miot.symptoms.duty.DutyStore;
import com.microboxlabs.miot.symptoms.duty.RedisDutyStore;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.redis.client.Command;
import io.vertx.mutiny.redis.client.Redis;
import io.vertx.mutiny.redis.client.Request;
import io.vertx.mutiny.redis.client.Response;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

/**
 * Reads what one organization's evaluation of a vehicle's signal starts from: its episodes and, when the
 * organization has symptoms on the duty counters, the counters, read after the episodes so the close revision is
 * never newer than the counters (an operator's close restarts the counters before it moves the revision).
 */
interface VehicleReads {

    /**
     * Started reads; each supplier waits for its answer.
     *
     * @param counters the duty counters, or null when they were not read
     */
    record Read(Supplier<AssetEpisodes> episodes, Supplier<DutyStore.Loaded> counters) {
    }

    /** Starts the reads; with {@code counters} false the duty counters are not read. */
    Read read(String tenantCode, String assetId, boolean counters);

    /** One read after the other, as they answer. */
    static VehicleReads of(EpisodeRepository episodes, DutyStore duty) {
        return (tenantCode, assetId, counters) -> {
            AssetEpisodes state = episodes.load(tenantCode, assetId);
            DutyStore.Loaded loaded = counters ? duty.load(tenantCode, assetId) : null;
            return new Read(() -> state, loaded == null ? null : () -> loaded);
        };
    }

    /**
     * Both reads in one pipeline on one connection ({@link RedisEpisodes}, {@link RedisDutyStore}): one round trip,
     * and Redis runs them in order. The answers are parsed on the caller's thread.
     */
    static VehicleReads redis(Redis redis) {
        Duration timeout = Duration.ofSeconds(5);
        return (tenantCode, assetId, counters) -> {
            List<Request> reads = new ArrayList<>(2);
            reads.add(Request.cmd(Command.HGETALL).arg(RedisEpisodes.key(tenantCode, assetId)));
            if (counters) {
                reads.add(Request.cmd(Command.HMGET).arg(RedisDutyStore.key(tenantCode, assetId))
                        .arg(RedisDutyStore.STATE).arg(RedisDutyStore.RESTARTS));
            }
            CompletableFuture<List<Response>> sent = redis.batch(reads).subscribeAsCompletionStage();
            Supplier<List<Response>> answers = () -> Uni.createFrom().completionStage(sent).await().atMost(timeout);
            return new Read(() -> RedisEpisodes.episodes(tenantCode, assetId, answers.get().get(0)),
                    counters ? () -> RedisDutyStore.loaded(answers.get().get(1)) : null);
        };
    }
}

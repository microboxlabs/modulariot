package com.microboxlabs.miot.symptoms.evaluator;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.mutiny.redis.client.Response;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Episodes in Redis: one hash per organization and vehicle,
 * {@code symptoms:ep:<tenant>:<asset>}, with a field {@code ep:<symptom id>}
 * per episode (JSON) and {@code wm:<source>} per watermark (epoch ms). The
 * hash expires {@code ttl} after its last write, so a vehicle that stops
 * sending costs nothing.
 */
public class RedisEpisodes implements EpisodeRepository {

    static final String PREFIX = "symptoms:ep:";
    private static final String EPISODE = "ep:";
    private static final String WATERMARK = "wm:";
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    /** Ignores fields it does not know, so episodes written before a field was dropped still load. */
    private static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

    private final RedisAPI redis;
    private final Duration ttl;

    public RedisEpisodes(RedisAPI redis, Duration ttl) {
        this.redis = redis;
        this.ttl = ttl;
    }

    static String key(String tenantCode, String assetId) {
        return PREFIX + tenantCode + ":" + assetId;
    }

    @Override
    public AssetEpisodes load(String tenantCode, String assetId) {
        Response all = redis.hgetall(key(tenantCode, assetId)).await().atMost(TIMEOUT);
        Map<UUID, Episode> episodes = new HashMap<>();
        Map<String, Instant> watermarks = new HashMap<>();
        if (all != null) {
            for (String field : all.getKeys()) {
                String value = all.get(field).toString();
                if (field.startsWith(EPISODE)) {
                    episodes.put(UUID.fromString(field.substring(EPISODE.length())), read(value));
                } else if (field.startsWith(WATERMARK)) {
                    watermarks.put(field.substring(WATERMARK.length()), Instant.ofEpochMilli(Long.parseLong(value)));
                }
            }
        }
        return new AssetEpisodes(tenantCode, assetId, episodes, watermarks);
    }

    /**
     * HSET, HDEL and EXPIRE in one script, so a failure leaves either all of a signal's changes or none.
     * ARGV: ttl seconds, number of field/value pairs, the pairs, then the fields to delete.
     */
    static final String SAVE_SCRIPT = """
            local n = tonumber(ARGV[2])
            if n > 0 then redis.call('HSET', KEYS[1], unpack(ARGV, 3, 2 + 2 * n)) end
            if #ARGV > 2 + 2 * n then redis.call('HDEL', KEYS[1], unpack(ARGV, 3 + 2 * n, #ARGV)) end
            redis.call('EXPIRE', KEYS[1], ARGV[1])
            return 1
            """;

    /** Writes what changed since {@link #load}, and resets the expiry. */
    @Override
    public void save(AssetEpisodes changes) {
        List<String> args = saveArgs(changes, ttl);
        if (!args.isEmpty()) {
            redis.eval(args).await().atMost(TIMEOUT);
        }
    }

    /** The EVAL arguments for {@link #save}, or none when nothing changed. */
    static List<String> saveArgs(AssetEpisodes changes, Duration ttl) {
        List<String> pairs = new ArrayList<>();
        changes.saved().forEach((id, e) -> {
            pairs.add(EPISODE + id);
            pairs.add(write(e));
        });
        changes.marked().forEach((source, at) -> {
            pairs.add(WATERMARK + source);
            pairs.add(Long.toString(at.toEpochMilli()));
        });
        if (pairs.isEmpty() && changes.deleted().isEmpty()) {
            return List.of();
        }
        List<String> args = new ArrayList<>(List.of(SAVE_SCRIPT, "1", key(changes.tenantCode(), changes.assetId()),
                Long.toString(ttl.toSeconds()), Integer.toString(pairs.size() / 2)));
        args.addAll(pairs);
        changes.deleted().forEach(id -> args.add(EPISODE + id));
        return args;
    }

    @Override
    public void forget(String tenantCode, String assetId, UUID definitionId) {
        redis.hdel(List.of(key(tenantCode, assetId), EPISODE + definitionId)).await().atMost(TIMEOUT);
    }

    static String write(Episode e) {
        try {
            return JSON.writeValueAsString(e);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    static Episode read(String json) {
        try {
            return JSON.readValue(json, Episode.class);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }
}

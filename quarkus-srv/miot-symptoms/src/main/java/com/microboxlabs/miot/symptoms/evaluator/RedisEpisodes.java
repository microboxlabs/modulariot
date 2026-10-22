package com.microboxlabs.miot.symptoms.evaluator;

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

    private static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

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

    /** Writes what changed since {@link #load}, and resets the expiry. */
    @Override
    public void save(AssetEpisodes changes) {
        String key = key(changes.tenantCode(), changes.assetId());
        List<String> set = new ArrayList<>();
        set.add(key);
        changes.saved().forEach((id, e) -> {
            set.add(EPISODE + id);
            set.add(write(e));
        });
        changes.marked().forEach((source, at) -> {
            set.add(WATERMARK + source);
            set.add(Long.toString(at.toEpochMilli()));
        });
        if (set.size() > 1) {
            redis.hset(set).await().atMost(TIMEOUT);
        }
        if (!changes.deleted().isEmpty()) {
            List<String> del = new ArrayList<>();
            del.add(key);
            changes.deleted().forEach(id -> del.add(EPISODE + id));
            redis.hdel(del).await().atMost(TIMEOUT);
        }
        if (set.size() > 1 || !changes.deleted().isEmpty()) {
            redis.expire(List.of(key, Long.toString(ttl.toSeconds()))).await().atMost(TIMEOUT);
        }
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

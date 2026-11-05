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
import java.util.ConcurrentModificationException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private static final String CLOSE_REVISION = "close:revision";
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

    static String tenantsKey(String assetId) {
        return "symptoms:ep-tenants:" + assetId;
    }

    @Override
    public Set<String> tenantsWithEpisodes(String assetId) {
        Response all = redis.smembers(tenantsKey(assetId)).await().atMost(TIMEOUT);
        Set<String> tenants = new HashSet<>();
        if (all != null) {
            all.forEach(value -> tenants.add(value.toString()));
        }
        return tenants;
    }

    @Override
    public AssetEpisodes load(String tenantCode, String assetId) {
        Response all = redis.hgetall(key(tenantCode, assetId)).await().atMost(TIMEOUT);
        Map<UUID, Episode> episodes = new HashMap<>();
        Map<String, Instant> watermarks = new HashMap<>();
        long closeRevision = 0;
        if (all != null) {
            for (String field : all.getKeys()) {
                String value = all.get(field).toString();
                if (field.startsWith(EPISODE)) {
                    episodes.put(UUID.fromString(field.substring(EPISODE.length())), read(value));
                } else if (field.startsWith(WATERMARK)) {
                    watermarks.put(field.substring(WATERMARK.length()), Instant.ofEpochMilli(Long.parseLong(value)));
                } else if (field.equals(CLOSE_REVISION)) {
                    closeRevision = Long.parseLong(value);
                }
            }
        }
        return new AssetEpisodes(tenantCode, assetId, episodes, watermarks, closeRevision);
    }

    /**
     * HSET, HDEL and EXPIRE in one script, so a failure leaves either all of a signal's changes or none.
     * Also indexes organizations with unfinished episodes for reconciliation after signal access ends.
     * ARGV: ttl seconds, number of field/value pairs, has episodes, tenant, expected operator-close revision,
     * the pairs, then fields to delete. An intervening close rejects every write, including watermarks and indexes.
     */
    static final String SAVE_SCRIPT = """
            if (redis.call('HGET', KEYS[1], 'close:revision') or '0') ~= ARGV[5] then return 0 end
            local n = tonumber(ARGV[2])
            if n > 0 then redis.call('HSET', KEYS[1], unpack(ARGV, 6, 5 + 2 * n)) end
            if #ARGV > 5 + 2 * n then redis.call('HDEL', KEYS[1], unpack(ARGV, 6 + 2 * n, #ARGV)) end
            if n > 0 or #ARGV > 5 + 2 * n then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
            if ARGV[3] == '1' then
                redis.call('SADD', KEYS[2], ARGV[4])
                redis.call('EXPIRE', KEYS[2], ARGV[1])
            else
                redis.call('SREM', KEYS[2], ARGV[4])
            end
            return 1
            """;

    /** Writes what changed since {@link #load}, and resets the expiry. */
    @Override
    public void save(AssetEpisodes changes) {
        Response result = redis.eval(saveArgs(changes, ttl)).await().atMost(TIMEOUT);
        if (result.toLong() == 0) {
            throw new ConcurrentModificationException("An operator closed a case after the episodes were loaded");
        }
    }

    /** The EVAL arguments for {@link #save}, including removal of an expired organization's index entry. */
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
        List<String> args = new ArrayList<>(List.of(SAVE_SCRIPT, "2", key(changes.tenantCode(), changes.assetId()),
                tenantsKey(changes.assetId()), Long.toString(ttl.toSeconds()), Integer.toString(pairs.size() / 2),
                changes.hasEpisodes() ? "1" : "0", changes.tenantCode(), Long.toString(changes.closeRevision())));
        args.addAll(pairs);
        changes.deleted().forEach(id -> args.add(EPISODE + id));
        return args;
    }

    @Override
    public void forget(String tenantCode, String assetId, UUID definitionId) {
        operatorClose(tenantCode, assetId, definitionId, null);
    }

    /**
     * Invalidates in-flight snapshots and replaces the closed symptom's episode in one operation. ARGV:
     * ttl seconds, tenant, episode field, marker JSON (empty to delete). Other episodes and watermarks survive.
     */
    static final String CLOSE_SCRIPT = """
            redis.call('HINCRBY', KEYS[1], 'close:revision', 1)
            if ARGV[4] == '' then
                redis.call('HDEL', KEYS[1], ARGV[3])
            else
                redis.call('HSET', KEYS[1], ARGV[3], ARGV[4])
            end
            redis.call('EXPIRE', KEYS[1], ARGV[1])
            local has_episodes = false
            for _, field in ipairs(redis.call('HKEYS', KEYS[1])) do
                if string.sub(field, 1, 3) == 'ep:' then has_episodes = true; break end
            end
            if has_episodes then
                redis.call('SADD', KEYS[2], ARGV[2])
                redis.call('EXPIRE', KEYS[2], ARGV[1])
            else
                redis.call('SREM', KEYS[2], ARGV[2])
            end
            return 1
            """;

    @Override
    public void operatorClose(String tenantCode, String assetId, UUID definitionId, Episode marker) {
        redis.eval(List.of(CLOSE_SCRIPT, "2", key(tenantCode, assetId), tenantsKey(assetId),
                Long.toString(ttl.toSeconds()), tenantCode, EPISODE + definitionId,
                marker == null ? "" : write(marker))).await().atMost(TIMEOUT);
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

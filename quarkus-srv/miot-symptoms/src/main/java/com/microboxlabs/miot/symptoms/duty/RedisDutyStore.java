package com.microboxlabs.miot.symptoms.duty;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.mutiny.redis.client.Response;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.List;

/**
 * Duty counters in Redis: one hash per organization and vehicle, {@code symptoms:duty:<tenant>:<asset>}, with
 * the state as JSON in {@code state} and the requested duty restarts in {@code restarts}. Only the frame consumer
 * writes {@code state} and only an operator's close increments {@code restarts}, so neither overwrites the other.
 * The hash expires {@code ttl} after its last write.
 */
public class RedisDutyStore implements DutyStore {

    static final String PREFIX = "symptoms:duty:";
    private static final String STATE = "state";
    private static final String RESTARTS = "restarts";
    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

    /** ARGV: ttl seconds, field, value; an empty value increments the field. */
    static final String WRITE_SCRIPT = """
            if ARGV[3] == '' then redis.call('HINCRBY', KEYS[1], ARGV[2], 1)
            else redis.call('HSET', KEYS[1], ARGV[2], ARGV[3]) end
            redis.call('EXPIRE', KEYS[1], ARGV[1])
            return 1
            """;

    private final RedisAPI redis;
    private final Duration ttl;

    public RedisDutyStore(RedisAPI redis, Duration ttl) {
        this.redis = redis;
        this.ttl = ttl;
    }

    static String key(String tenantCode, String assetId) {
        return PREFIX + tenantCode + ":" + assetId;
    }

    @Override
    public Loaded load(String tenantCode, String assetId) {
        Response r = redis.hmget(List.of(key(tenantCode, assetId), STATE, RESTARTS)).await().atMost(TIMEOUT);
        Response state = r == null ? null : r.get(0);
        Response restarts = r == null ? null : r.get(1);
        return new Loaded(state == null ? null : read(state.toString()),
                restarts == null ? 0 : Long.parseLong(restarts.toString()));
    }

    @Override
    public void save(String tenantCode, String assetId, DutyState state) {
        write(tenantCode, assetId, STATE, write(state));
    }

    @Override
    public void restartDuty(String tenantCode, String assetId) {
        write(tenantCode, assetId, RESTARTS, "");
    }

    private void write(String tenantCode, String assetId, String field, String value) {
        redis.eval(List.of(WRITE_SCRIPT, "1", key(tenantCode, assetId), Long.toString(ttl.toSeconds()), field, value))
                .await().atMost(TIMEOUT);
    }

    static String write(DutyState s) {
        try {
            return JSON.writeValueAsString(s);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static DutyState read(String json) {
        try {
            return JSON.readValue(json, DutyState.class);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

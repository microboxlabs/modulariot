package com.microboxlabs.miot.symptoms.lostsignal;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.vertx.mutiny.redis.client.Command;
import io.vertx.mutiny.redis.client.Redis;
import io.vertx.mutiny.redis.client.Request;
import io.vertx.mutiny.redis.client.Response;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * The lost-signal state in Redis: the vehicle's profile in the hash {@code symptoms:veh:<asset>} (field
 * {@code p}), the sender's in {@code symptoms:snd:<sender>}, both JSON with times in epoch ms. One pipelined round
 * trip reads both and one writes both; each expires {@code ttl} after its last frame.
 */
public class RedisLossStore implements LossStore {

    static final String VEHICLE = "symptoms:veh:";
    static final String SENDER = "symptoms:snd:";
    static final String PROFILE = "p";
    static final Duration TIMEOUT = Duration.ofSeconds(5);

    static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
            .enable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(SerializationFeature.WRITE_DATE_TIMESTAMPS_AS_NANOSECONDS)
            .disable(DeserializationFeature.READ_DATE_TIMESTAMPS_AS_NANOSECONDS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .setSerializationInclusion(JsonInclude.Include.NON_NULL);

    private final Redis redis;
    private final Duration ttl;

    public RedisLossStore(Redis redis, Duration ttl) {
        this.redis = redis;
        this.ttl = ttl;
    }

    static String vehicleKey(String assetId) {
        return VEHICLE + assetId;
    }

    static String senderKey(String sender) {
        return SENDER + sender;
    }

    @Override
    public Profiles load(String assetId, String sender) {
        List<Request> reads = new ArrayList<>();
        reads.add(Request.cmd(Command.HGET).arg(vehicleKey(assetId)).arg(PROFILE));
        if (sender != null) {
            reads.add(Request.cmd(Command.GET).arg(senderKey(sender)));
        }
        List<Response> r = redis.batch(reads).await().atMost(TIMEOUT);
        return new Profiles(read(r.get(0), VehicleProfile.class),
                sender == null ? null : read(r.get(1), SenderProfile.class));
    }

    @Override
    public void save(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile) {
        redis.batch(saveRequests(assetId, vehicle, sender, senderProfile, ttl)).await().atMost(TIMEOUT);
    }

    static List<Request> saveRequests(String assetId, VehicleProfile vehicle, String sender,
            SenderProfile senderProfile, Duration ttl) {
        String seconds = Long.toString(ttl.toSeconds());
        List<Request> writes = new ArrayList<>();
        writes.add(Request.cmd(Command.HSET).arg(vehicleKey(assetId)).arg(PROFILE).arg(write(vehicle)));
        writes.add(Request.cmd(Command.EXPIRE).arg(vehicleKey(assetId)).arg(seconds));
        if (sender != null) {
            writes.add(Request.cmd(Command.SET).arg(senderKey(sender)).arg(write(senderProfile)).arg("EX")
                    .arg(seconds));
        }
        return writes;
    }

    static String write(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static <T> T read(Response r, Class<T> type) {
        if (r == null) {
            return null;
        }
        try {
            return JSON.readValue(r.toString(), type);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

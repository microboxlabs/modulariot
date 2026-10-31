package com.microboxlabs.miot.symptoms.lostsignal;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.microboxlabs.miot.symptoms.lostsignal.IngestHealth.Heartbeat;
import io.vertx.mutiny.redis.client.Command;
import io.vertx.mutiny.redis.client.Redis;
import io.vertx.mutiny.redis.client.Request;
import io.vertx.mutiny.redis.client.Response;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * The lost-signal state in Redis, every key expiring {@code ttl} after its last write:
 * <ul>
 * <li>{@code symptoms:veh:<asset>}, a hash: {@code p} the vehicle's profile, {@code w} its watch (written by
 * frames), {@code c} its check state (written by the ticker);</li>
 * <li>{@code symptoms:snd:<sender>}: the sender's profile;</li>
 * <li>{@code symptoms:deadlines}: a sorted set of vehicles by deadline (epoch ms);</li>
 * <li>{@code symptoms:lost-signal:lease}: the ticker's owner; {@code symptoms:ingest}: one heartbeat per replica.</li>
 * </ul>
 * Values are JSON with times in epoch ms. A frame reads in one pipelined round trip and writes in another.
 */
public class RedisLossStore implements LossStore {

    static final String VEHICLE = "symptoms:veh:";
    static final String SENDER = "symptoms:snd:";
    static final String DEADLINES = "symptoms:deadlines";
    static final String LEASE = "symptoms:lost-signal:lease";
    static final String INGEST = "symptoms:ingest";
    static final String PROFILE = "p";
    static final String WATCH = "w";
    static final String CHECK = "c";
    static final Duration TIMEOUT = Duration.ofSeconds(5);

    /** Takes the lease when free, renews it when held: ARGV owner, ttl ms. */
    static final String LEASE_SCRIPT = """
            local owner = redis.call('GET', KEYS[1])
            if owner == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
            if not owner then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]) return 1 end
            return 0
            """;

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
        reads.add(Request.cmd(Command.HMGET).arg(vehicleKey(assetId)).arg(PROFILE).arg(CHECK));
        if (sender != null) {
            reads.add(Request.cmd(Command.GET).arg(senderKey(sender)));
        }
        List<Response> r = batch(reads);
        Response fields = r.get(0);
        return new Profiles(read(fields.get(0), VehicleProfile.class),
                sender == null ? null : read(r.get(1), SenderProfile.class), read(fields.get(1), CheckState.class));
    }

    @Override
    public void save(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile,
            Schedule schedule) {
        batch(saveRequests(assetId, vehicle, sender, senderProfile, schedule, ttl));
    }

    static List<Request> saveRequests(String assetId, VehicleProfile vehicle, String sender,
            SenderProfile senderProfile, Schedule schedule, Duration ttl) {
        String seconds = Long.toString(ttl.toSeconds());
        String key = vehicleKey(assetId);
        List<Request> writes = new ArrayList<>();
        Request hset = Request.cmd(Command.HSET).arg(key).arg(PROFILE).arg(write(vehicle));
        if (schedule.kind() == Schedule.Kind.AT) {
            hset.arg(WATCH).arg(write(schedule.watch()));
        }
        writes.add(hset);
        if (schedule.kind() == Schedule.Kind.DROP) {
            writes.add(Request.cmd(Command.HDEL).arg(key).arg(WATCH));
            writes.add(Request.cmd(Command.ZREM).arg(DEADLINES).arg(assetId));
        }
        writes.add(Request.cmd(Command.EXPIRE).arg(key).arg(seconds));
        if (sender != null) {
            writes.add(Request.cmd(Command.SET).arg(senderKey(sender)).arg(write(senderProfile)).arg("EX")
                    .arg(seconds));
        }
        if (schedule.kind() == Schedule.Kind.AT) {
            writes.add(Request.cmd(Command.ZADD).arg(DEADLINES).arg(schedule.at().toEpochMilli()).arg(assetId));
            writes.add(Request.cmd(Command.EXPIRE).arg(DEADLINES).arg(seconds));
        }
        return writes;
    }

    @Override
    public List<String> due(Instant now, int limit) {
        Response r = batch(List.of(Request.cmd(Command.ZRANGEBYSCORE).arg(DEADLINES).arg("-inf")
                .arg(now.toEpochMilli()).arg("LIMIT").arg(0).arg(limit))).get(0);
        List<String> out = new ArrayList<>();
        if (r != null) {
            r.forEach(member -> out.add(member.toString()));
        }
        return out;
    }

    @Override
    public Vehicle vehicle(String assetId) {
        Response fields = batch(List.of(Request.cmd(Command.HMGET).arg(vehicleKey(assetId)).arg(PROFILE).arg(WATCH)
                .arg(CHECK))).get(0);
        return new Vehicle(read(fields.get(0), VehicleProfile.class), read(fields.get(1), Watch.class),
                read(fields.get(2), CheckState.class));
    }

    @Override
    public void checked(String assetId, CheckState check, Instant next) {
        batch(checkedRequests(assetId, check, next, ttl));
    }

    static List<Request> checkedRequests(String assetId, CheckState check, Instant next, Duration ttl) {
        String key = vehicleKey(assetId);
        List<Request> writes = new ArrayList<>();
        if (CheckState.NONE.equals(check)) {
            writes.add(Request.cmd(Command.HDEL).arg(key).arg(CHECK));
        } else {
            writes.add(Request.cmd(Command.HSET).arg(key).arg(CHECK).arg(write(check)));
            writes.add(Request.cmd(Command.EXPIRE).arg(key).arg(ttl.toSeconds()));
        }
        // XX: a frame that dropped the vehicle meanwhile (its trip ended) is not undone.
        writes.add(next == null ? Request.cmd(Command.ZREM).arg(DEADLINES).arg(assetId)
                : Request.cmd(Command.ZADD).arg(DEADLINES).arg("XX").arg(next.toEpochMilli()).arg(assetId));
        return writes;
    }

    @Override
    public boolean lease(String owner, Duration leaseTtl) {
        Response r = batch(List.of(Request.cmd(Command.EVAL).arg(LEASE_SCRIPT).arg(1).arg(LEASE).arg(owner)
                .arg(leaseTtl.toMillis()))).get(0);
        return r != null && r.toInteger() == 1;
    }

    @Override
    public void heartbeat(Heartbeat beat) {
        batch(List.of(Request.cmd(Command.HSET).arg(INGEST).arg(beat.owner())
                .arg(beat.at().toEpochMilli() + ":" + beat.lag().toMillis()),
                Request.cmd(Command.EXPIRE).arg(INGEST).arg(ttl.toSeconds())));
    }

    @Override
    public List<Heartbeat> heartbeats() {
        Response all = batch(List.of(Request.cmd(Command.HGETALL).arg(INGEST))).get(0);
        List<Heartbeat> out = new ArrayList<>();
        if (all != null) {
            for (String owner : all.getKeys()) {
                heartbeat(owner, all.get(owner).toString()).ifPresent(out::add);
            }
        }
        return out;
    }

    static Optional<Heartbeat> heartbeat(String owner, String value) {
        String[] parts = value.split(":");
        try {
            return Optional.of(new Heartbeat(owner, Instant.ofEpochMilli(Long.parseLong(parts[0])),
                    Duration.ofMillis(Long.parseLong(parts[1]))));
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }

    private List<Response> batch(List<Request> requests) {
        return redis.batch(requests).await().atMost(TIMEOUT);
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

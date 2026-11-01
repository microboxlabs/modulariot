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
import org.jboss.logging.Logger;

/**
 * The lost-signal state in Redis, every key expiring {@code ttl} after its last write:
 * <ul>
 * <li>{@code symptoms:veh:<asset>}, a hash: {@code p} the vehicle's profile, {@code w} its watch, {@code r} and
 * {@code b} the return and backfill marks of its loss ({@code <lost ms>:<arrival ms>}, {@code <lost ms>}), all
 * written by frames; {@code c} its check state, written by the ticker;</li>
 * <li>{@code symptoms:snd:<sender>}: the sender's profile;</li>
 * <li>{@code symptoms:deadlines}: a sorted set of vehicles by deadline (epoch ms);</li>
 * <li>{@code symptoms:lost-signal:lease}: the ticker's owner; {@code symptoms:ingest}: one heartbeat per replica.</li>
 * </ul>
 * Values are JSON with times in epoch ms. A frame reads in one pipelined round trip and writes in another.
 */
public class RedisLossStore implements LossStore {

    private static final Logger LOG = Logger.getLogger(RedisLossStore.class);
    static final String VEHICLE = "symptoms:veh:";
    static final String SENDER = "symptoms:snd:";
    static final String DEADLINES = "symptoms:deadlines";
    static final String LEASE = "symptoms:lost-signal:lease";
    static final String INGEST = "symptoms:ingest";
    static final String PROFILE = "p";
    static final String WATCH = "w";
    static final String CHECK = "c";
    static final String RETURNED = "r";
    static final String BACKFILL = "b";
    static final Duration TIMEOUT = Duration.ofSeconds(5);

    /** Takes the lease when free, renews it when held: ARGV owner, ttl ms. */
    static final String LEASE_SCRIPT = """
            local owner = redis.call('GET', KEYS[1])
            if owner == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
            if not owner then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]) return 1 end
            return 0
            """;

    /**
     * A check's write, only while the deadline is the one the check read: KEYS vehicle, deadlines; ARGV asset,
     * seen ms ("" none), check JSON ("" clears), next ms ("" drops), ttl s, "1" to clear the loss's marks.
     * XX: no deadline is created.
     */
    static final String CHECKED_SCRIPT = """
            local s = redis.call('ZSCORE', KEYS[2], ARGV[1])
            if ARGV[2] == '' then
              if s then return 0 end
            elseif not s or tonumber(s) ~= tonumber(ARGV[2]) then return 0 end
            if ARGV[3] == '' then redis.call('HDEL', KEYS[1], 'c')
            else redis.call('HSET', KEYS[1], 'c', ARGV[3]) redis.call('EXPIRE', KEYS[1], ARGV[5]) end
            if ARGV[6] == '1' then redis.call('HDEL', KEYS[1], 'r', 'b') end
            if ARGV[4] == '' then redis.call('ZREM', KEYS[2], ARGV[1])
            else redis.call('ZADD', KEYS[2], 'XX', ARGV[4], ARGV[1]) end
            return 1
            """;

    /** Heartbeats older than this are a replica that is gone and are pruned when read. */
    static final Duration HEARTBEAT_RETIRED = Duration.ofHours(1);

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
            Schedule schedule, Mark mark) {
        batch(saveRequests(assetId, vehicle, sender, senderProfile, schedule, mark, ttl));
    }

    static List<Request> saveRequests(String assetId, VehicleProfile vehicle, String sender,
            SenderProfile senderProfile, Schedule schedule, Mark mark, Duration ttl) {
        String seconds = Long.toString(ttl.toSeconds());
        String key = vehicleKey(assetId);
        List<Request> writes = new ArrayList<>();
        Request hset = Request.cmd(Command.HSET).arg(key).arg(PROFILE).arg(write(vehicle));
        if (schedule.kind() == Schedule.Kind.AT) {
            hset.arg(WATCH).arg(write(schedule.watch()));
        }
        writes.add(hset);
        if (mark != null && mark.returnedAt() != null) {
            // NX: the first frame after the loss is the return; a later one for the same loss keeps it.
            writes.add(Request.cmd(Command.HSETNX).arg(key).arg(RETURNED)
                    .arg(mark.lostSince().toEpochMilli() + ":" + mark.returnedAt().toEpochMilli()));
        }
        if (mark != null && mark.backfill()) {
            writes.add(Request.cmd(Command.HSET).arg(key).arg(BACKFILL).arg(mark.lostSince().toEpochMilli()));
        }
        if (schedule.kind() == Schedule.Kind.DROP || schedule.kind() == Schedule.Kind.CLEAR) {
            writes.add(Request.cmd(Command.HDEL).arg(key).arg(WATCH));
        }
        if (schedule.kind() == Schedule.Kind.DROP) {
            writes.add(Request.cmd(Command.ZREM).arg(DEADLINES).arg(assetId));
        }
        writes.add(Request.cmd(Command.EXPIRE).arg(key).arg(seconds));
        if (sender != null) {
            writes.add(Request.cmd(Command.SET).arg(senderKey(sender)).arg(write(senderProfile)).arg("EX")
                    .arg(seconds));
        }
        if (schedule.kind() == Schedule.Kind.AT || schedule.kind() == Schedule.Kind.CLEAR) {
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
        List<Response> r = batch(List.of(Request.cmd(Command.HMGET).arg(vehicleKey(assetId)).arg(PROFILE).arg(WATCH)
                .arg(CHECK).arg(RETURNED).arg(BACKFILL), Request.cmd(Command.ZSCORE).arg(DEADLINES).arg(assetId)));
        Response fields = r.get(0);
        Response score = r.get(1);
        CheckState check = read(fields.get(2), CheckState.class);
        String lost = check == null || !check.lost() ? null : Long.toString(check.lostSince().toEpochMilli());
        return new Vehicle(read(fields.get(0), VehicleProfile.class), read(fields.get(1), Watch.class), check,
                returnedAt(lost, fields.get(3)), lost != null && fields.get(4) != null
                        && lost.equals(fields.get(4).toString()),
                score == null ? null : Instant.ofEpochMilli((long) Double.parseDouble(score.toString())));
    }

    /** The return mark's arrival when it belongs to the current loss. */
    static Instant returnedAt(String lost, Response mark) {
        if (lost == null || mark == null) {
            return null;
        }
        String[] parts = mark.toString().split(":");
        return parts.length == 2 && parts[0].equals(lost) ? Instant.ofEpochMilli(Long.parseLong(parts[1])) : null;
    }

    @Override
    public boolean checked(String assetId, Instant seen, CheckState check, Instant next) {
        Response r = batch(List.of(checkedRequest(assetId, seen, check, next, ttl))).get(0);
        return r != null && r.toInteger() == 1;
    }

    static Request checkedRequest(String assetId, Instant seen, CheckState check, Instant next, Duration ttl) {
        return Request.cmd(Command.EVAL).arg(CHECKED_SCRIPT).arg(2).arg(vehicleKey(assetId)).arg(DEADLINES)
                .arg(assetId).arg(seen == null ? "" : Long.toString(seen.toEpochMilli()))
                .arg(CheckState.NONE.equals(check) ? "" : write(check))
                .arg(next == null ? "" : Long.toString(next.toEpochMilli())).arg(ttl.toSeconds())
                .arg(check.lost() ? "" : "1");
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
        List<String> retired = new ArrayList<>();
        Instant cutoff = Instant.now().minus(HEARTBEAT_RETIRED);
        if (all != null) {
            for (String owner : all.getKeys()) {
                Optional<Heartbeat> beat = heartbeat(owner, all.get(owner).toString());
                if (beat.isEmpty() || beat.get().at().isBefore(cutoff)) {
                    retired.add(owner);
                } else {
                    out.add(beat.get());
                }
            }
        }
        if (!retired.isEmpty()) {
            Request hdel = Request.cmd(Command.HDEL).arg(INGEST);
            retired.forEach(hdel::arg);
            batch(List.of(hdel));
        }
        return out;
    }

    static java.util.Optional<Heartbeat> heartbeat(String owner, String value) {
        String[] parts = value.split(":");
        try {
            return java.util.Optional.of(new Heartbeat(owner, Instant.ofEpochMilli(Long.parseLong(parts[0])),
                    Duration.ofMillis(Long.parseLong(parts[1]))));
        } catch (RuntimeException e) {
            return java.util.Optional.empty();
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

    /** The stored value, or null when absent or unreadable (an older shape): the next save replaces it. */
    static <T> T read(Response r, Class<T> type) {
        if (r == null) {
            return null;
        }
        try {
            return JSON.readValue(r.toString(), type);
        } catch (IOException e) {
            LOG.debugf("Lost-signal store: unreadable %s dropped", type.getSimpleName());
            return null;
        }
    }
}

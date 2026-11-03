package com.microboxlabs.miot.symptoms.signal;

import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.mutiny.redis.client.Response;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.jboss.logging.Logger;

/**
 * How many frames of each event type ({@code signal.frame.events[].event_type}) an organization received, per UTC
 * day, so the rule editor can offer the codes its GPS providers send. In Redis, {@code
 * symptoms:event-types:<tenant>:<day>} is a hash of type to count that expires {@link #TTL} after its last
 * write; without Redis the counts are kept in memory. At most {@link #MAX_TYPES} types a day, omitting codes
 * longer than {@link #MAX_LENGTH} characters; only the exact type is kept.
 */
public class EventTypes {

    private static final Logger LOG = Logger.getLogger(EventTypes.class);
    static final String PREFIX = "symptoms:event-types:";
    public static final int MAX_DAYS = 30;
    static final int MAX_TYPES = 200;
    static final int MAX_LENGTH = 64;
    static final Duration TTL = Duration.ofDays(MAX_DAYS + 1L);
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    /** KEYS: the day's hash. ARGV: ttl seconds, the most types a day, then the types. */
    static final String COUNT_SCRIPT = """
            for i = 3, #ARGV do
                if redis.call('HEXISTS', KEYS[1], ARGV[i]) == 1
                        or redis.call('HLEN', KEYS[1]) < tonumber(ARGV[2]) then
                    redis.call('HINCRBY', KEYS[1], ARGV[i], 1)
                end
            end
            redis.call('EXPIRE', KEYS[1], ARGV[1])
            return 1
            """;

    /** One event type and how many frames carried it. */
    public record Count(String eventType, long count) {
    }

    private final RedisAPI redis;
    private final Clock clock;
    private final Map<String, Map<String, Long>> memory = new ConcurrentHashMap<>();

    EventTypes(RedisAPI redis, Clock clock) {
        this.redis = redis;
        this.clock = clock;
    }

    /** Counts the types of the signal's frame events, once per frame each; a frame without events costs nothing. */
    void count(String tenantCode, Map<String, Object> signal) {
        pruneMemory();
        Set<String> types = types(signal);
        if (types.isEmpty()) {
            return;
        }
        String key = key(tenantCode, today());
        if (redis == null) {
            Map<String, Long> day = memory.computeIfAbsent(key, k -> new ConcurrentHashMap<>());
            synchronized (day) {
                types.forEach(t -> {
                    if (day.containsKey(t) || day.size() < MAX_TYPES) {
                        day.merge(t, 1L, Long::sum);
                    }
                });
            }
            return;
        }
        List<String> args = new ArrayList<>(List.of(COUNT_SCRIPT, "1", key, Long.toString(TTL.toSeconds()),
                Integer.toString(MAX_TYPES)));
        args.addAll(types);
        try {
            redis.eval(args).await().atMost(TIMEOUT);
        } catch (RuntimeException e) {
            LOG.debugf("Event types not counted (%s)", e.getClass().getSimpleName());
        }
    }

    /** The types of the last {@code days} days (1 to {@link #MAX_DAYS}), most frequent first; none when Redis fails. */
    public List<Count> recent(String tenantCode, int days) {
        pruneMemory();
        Map<String, Long> sum = new HashMap<>();
        for (String key : recentKeys(tenantCode, Math.clamp(days, 1, MAX_DAYS))) {
            if (redis == null) {
                memory.getOrDefault(key, Map.of()).forEach((t, n) -> sum.merge(t, n, Long::sum));
                continue;
            }
            try {
                Response hash = redis.hgetall(key).await().atMost(TIMEOUT);
                if (hash != null) {
                    for (String t : hash.getKeys()) {
                        sum.merge(t, hash.get(t).toLong(), Long::sum);
                    }
                }
            } catch (RuntimeException e) {
                LOG.debugf("Event types not read (%s)", e.getClass().getSimpleName());
                return List.of();
            }
        }
        return sum.entrySet().stream().map(e -> new Count(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(Count::count).reversed().thenComparing(Count::eventType))
                .limit(MAX_TYPES).toList();
    }

    static Set<String> types(Map<String, Object> signal) {
        Set<String> out = new LinkedHashSet<>();
        if (signal.get("frame") instanceof Map<?, ?> frame && frame.get("events") instanceof List<?> events) {
            for (Object e : events) {
                if (e instanceof Map<?, ?> m && m.get("event_type") instanceof String t
                        && !t.isBlank() && t.length() <= MAX_LENGTH) {
                    out.add(t);
                }
            }
        }
        return out;
    }

    private List<String> recentKeys(String tenantCode, int days) {
        LocalDate today = today();
        List<String> keys = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            keys.add(key(tenantCode, today.minusDays(i)));
        }
        return keys;
    }

    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private void pruneMemory() {
        if (redis == null) {
            String firstDay = today().minusDays(MAX_DAYS - 1L).toString();
            memory.keySet().removeIf(k -> k.substring(k.length() - firstDay.length()).compareTo(firstDay) < 0);
        }
    }

    static String key(String tenantCode, LocalDate day) {
        return PREFIX + tenantCode + ":" + day;
    }
}

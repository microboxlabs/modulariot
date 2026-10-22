package com.microboxlabs.miot.symptoms.signal;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.evaluator.EvaluatorRedis;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.mutiny.redis.client.Response;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.jboss.logging.Logger;

/**
 * Recent GPS signals of each organization, so rule previews run on real
 * values. The evaluators keep at most one signal per organization every
 * {@link #EVERY}, checked in Redis so replicas share it. In Redis,
 * {@code symptoms:samples:<tenant>} holds the newest {@link #KEEP} and expires
 * {@link #TTL} after the last one; without Redis they are kept in memory. Only
 * the paths of the rule editor's fields ({@link SignalFields#fields()}) are
 * saved.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SignalSamples {

    private static final Logger LOG = Logger.getLogger(SignalSamples.class);
    static final String PREFIX = "symptoms:samples:";
    static final String RESOURCE = "/symptoms/gps-signal-samples.json";
    static final int KEEP = 20;
    static final Duration EVERY = Duration.ofSeconds(15);
    static final Duration TTL = Duration.ofDays(1);
    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final Set<String> FIELDS = SignalFields.fields().stream().map(SourceField::path)
            .collect(Collectors.toUnmodifiableSet());
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
    };

    /**
     * Admission and LPUSH, LTRIM and EXPIRE in one script. KEYS: the list, the admission key. ARGV: the signal,
     * how many to keep, ttl seconds, admission milliseconds.
     */
    static final String RECORD_SCRIPT = """
            if not redis.call('SET', KEYS[2], '1', 'NX', 'PX', ARGV[4]) then
                return 0
            end
            redis.call('LPUSH', KEYS[1], ARGV[1])
            redis.call('LTRIM', KEYS[1], 0, tonumber(ARGV[2]) - 1)
            redis.call('EXPIRE', KEYS[1], ARGV[3])
            return 1
            """;

    private final RedisAPI redis;
    private final Clock clock;
    private final Map<String, Instant> recorded = new ConcurrentHashMap<>();
    private final Map<String, Deque<String>> memory = new ConcurrentHashMap<>();

    @Inject
    SignalSamples(EvaluatorRedis redis) {
        this(redis.api().orElse(null), Clock.systemUTC());
    }

    SignalSamples(RedisAPI redis, Clock clock) {
        this.redis = redis;
        this.clock = clock;
    }

    /** Samples kept in memory. */
    public static SignalSamples inMemory() {
        return new SignalSamples(null, Clock.systemUTC());
    }

    /** Keeps the signal as a sample of the organization, unless one was kept less than {@link #EVERY} ago. */
    public void record(String tenantCode, Map<String, Object> signal) {
        if (!admit(tenantCode, clock.instant())) {
            return;
        }
        String json = write(trim(signal));
        if (redis == null) {
            Deque<String> kept = memory.computeIfAbsent(tenantCode, k -> new ArrayDeque<>());
            synchronized (kept) {
                kept.addFirst(json);
                while (kept.size() > KEEP) {
                    kept.removeLast();
                }
            }
            return;
        }
        try {
            redis.eval(recordArgs(tenantCode, json)).await().atMost(TIMEOUT);
        } catch (RuntimeException e) {
            LOG.debugf("Signal sample not saved (%s)", e.getClass().getSimpleName());
        }
    }

    /** Whether this instance has not kept a signal of the organization in the last {@link #EVERY}. */
    private boolean admit(String tenantCode, Instant now) {
        boolean[] admitted = { false };
        recorded.compute(tenantCode, (k, last) -> {
            if (last != null && last.plus(EVERY).isAfter(now)) {
                return last;
            }
            admitted[0] = true;
            return now;
        });
        return admitted[0];
    }

    static List<String> recordArgs(String tenantCode, String json) {
        return List.of(RECORD_SCRIPT, "2", PREFIX + tenantCode, PREFIX + tenantCode + ":gate", json,
                Integer.toString(KEEP), Long.toString(TTL.toSeconds()), Long.toString(EVERY.toMillis()));
    }

    /** The organization's newest samples as {@code {"signal": …}}, newest first; none when Redis fails. */
    public List<Map<String, Object>> recent(String tenantCode, int limit) {
        List<String> raw = new ArrayList<>();
        if (redis == null) {
            Deque<String> kept = memory.getOrDefault(tenantCode, new ArrayDeque<>());
            synchronized (kept) {
                kept.stream().limit(limit).forEach(raw::add);
            }
        } else {
            try {
                Response list = redis.lrange(PREFIX + tenantCode, "0", Integer.toString(limit - 1))
                        .await().atMost(TIMEOUT);
                if (list != null) {
                    list.forEach(r -> raw.add(r.toString()));
                }
            } catch (RuntimeException e) {
                LOG.debugf("Signal samples not read (%s)", e.getClass().getSimpleName());
                return List.of();
            }
        }
        return raw.stream().map(s -> Map.<String, Object>of(SignalFields.ROOT, read(s))).toList();
    }

    /** Samples with the signal's whole shape, for organizations without recent signals. */
    public static List<Map<String, Object>> fallback() {
        try (InputStream in = SignalSamples.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("missing " + RESOURCE);
            }
            return JSON.readValue(in, new TypeReference<List<Map<String, Object>>>() {
            });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** The signal with only the paths of the rule editor's fields. */
    static Map<String, Object> trim(Map<String, Object> signal) {
        return project(SignalFields.ROOT, signal);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> project(String prefix, Map<String, Object> node) {
        Map<String, Object> out = new LinkedHashMap<>();
        node.forEach((key, value) -> {
            String path = prefix + "." + key;
            if (value instanceof Map<?, ?> child) {
                Map<String, Object> inner = project(path, (Map<String, Object>) child);
                if (!inner.isEmpty()) {
                    out.put(key, inner);
                }
            } else if (FIELDS.contains(path)) {
                out.put(key, value);
            }
        });
        return out;
    }

    private static String write(Map<String, Object> signal) {
        try {
            return JSON.writeValueAsString(signal);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static Map<String, Object> read(String json) {
        try {
            return JSON.readValue(json, MAP);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

package com.microboxlabs.miot.symptoms.evaluator;

import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.redis.client.Command;
import io.vertx.redis.client.Redis;
import io.vertx.redis.client.RedisConnection;
import io.vertx.redis.client.Request;
import io.vertx.redis.client.Response;
import io.vertx.redis.client.ResponseType;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;

/**
 * An in-memory Redis for benchmarks and tests, without Docker: the commands and Lua scripts the evaluator, the duty
 * store, the samples and the lost-signal store send, answered from maps under one lock. Each {@code send} or
 * {@code batch} is one round trip, answered after {@code latencyMicros} on a timer thread, and counted.
 * Expiry is ignored.
 */
public final class FakeRedis implements Redis {

    private static final Method ARGS;

    static {
        try {
            ARGS = Class.forName("io.vertx.redis.client.impl.RequestImpl").getDeclaredMethod("getArgs");
            ARGS.setAccessible(true);
        } catch (ReflectiveOperationException e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    private final Map<String, Map<String, String>> hashes = new HashMap<>();
    private final Map<String, Set<String>> sets = new HashMap<>();
    private final Map<String, String> strings = new HashMap<>();
    private final Map<String, List<String>> lists = new HashMap<>();
    private final Map<String, Map<String, Double>> zsets = new HashMap<>();
    private final ScheduledExecutorService timer;
    private final long latencyMicros;
    private final AtomicLong roundTrips = new AtomicLong();
    private final Map<String, LongAdder> commands = new ConcurrentHashMap<>();

    public FakeRedis(long latencyMicros) {
        this.latencyMicros = latencyMicros;
        this.timer = latencyMicros > 0 ? Executors.newScheduledThreadPool(2, r -> {
            Thread t = new Thread(r, "fake-redis");
            t.setDaemon(true);
            return t;
        }) : null;
    }

    public io.vertx.mutiny.redis.client.Redis mutiny() {
        return io.vertx.mutiny.redis.client.Redis.newInstance(this);
    }

    public io.vertx.mutiny.redis.client.RedisAPI api() {
        return io.vertx.mutiny.redis.client.RedisAPI.api(mutiny());
    }

    public long roundTrips() {
        return roundTrips.get();
    }

    /** Commands by name (scripts by what they do), since the last reset. */
    public Map<String, Long> commands() {
        Map<String, Long> out = new java.util.TreeMap<>();
        commands.forEach((k, v) -> out.put(k, v.sum()));
        return out;
    }

    public void resetCounts() {
        roundTrips.set(0);
        commands.clear();
    }

    @Override
    public Future<RedisConnection> connect() {
        throw new UnsupportedOperationException();
    }

    @Override
    public void close() {
        if (timer != null) {
            timer.shutdownNow();
        }
    }

    @Override
    public Future<Response> send(Request request) {
        roundTrips.incrementAndGet();
        Response r;
        synchronized (this) {
            r = exec(request);
        }
        return later(r);
    }

    @Override
    public Future<List<Response>> batch(List<Request> requests) {
        roundTrips.incrementAndGet();
        List<Response> out = new ArrayList<>();
        synchronized (this) {
            requests.forEach(q -> out.add(exec(q)));
        }
        return later(out);
    }

    private <T> Future<T> later(T value) {
        if (timer == null) {
            return Future.succeededFuture(value);
        }
        Promise<T> p = Promise.promise();
        timer.schedule(() -> p.complete(value), latencyMicros, TimeUnit.MICROSECONDS);
        return p.future();
    }

    @SuppressWarnings("unchecked")
    private static List<String> args(Request r) {
        try {
            List<byte[]> raw = (List<byte[]>) ARGS.invoke(r);
            List<String> out = new ArrayList<>(raw.size());
            raw.forEach(b -> out.add(b == null ? null : new String(b, StandardCharsets.UTF_8)));
            return out;
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private void count(String name) {
        commands.computeIfAbsent(name, k -> new LongAdder()).increment();
    }

    private Response exec(Request request) {
        Command c = request.command();
        List<String> a = args(request);
        if (c == Command.EVAL) {
            return eval(a);
        }
        String name = c.toString().toUpperCase();
        count(name);
        return switch (name) {
            case "PING" -> FakeResponse.simple("PONG");
            case "HGETALL" -> FakeResponse.map(hash(a.get(0)));
            case "HGET" -> FakeResponse.bulk(hash(a.get(0)).get(a.get(1)));
            case "HMGET" -> {
                Map<String, String> h = hash(a.get(0));
                List<Response> out = new ArrayList<>();
                a.subList(1, a.size()).forEach(f -> out.add(FakeResponse.bulk(h.get(f))));
                yield FakeResponse.array(out);
            }
            case "HSET" -> {
                Map<String, String> h = hashes.computeIfAbsent(a.get(0), k -> new HashMap<>());
                for (int i = 1; i + 1 < a.size(); i += 2) {
                    h.put(a.get(i), a.get(i + 1));
                }
                yield FakeResponse.number(1);
            }
            case "HSETNX" -> FakeResponse.number(
                    hashes.computeIfAbsent(a.get(0), k -> new HashMap<>()).putIfAbsent(a.get(1), a.get(2)) == null ? 1
                            : 0);
            case "HDEL" -> {
                Map<String, String> h = hash(a.get(0));
                a.subList(1, a.size()).forEach(h::remove);
                yield FakeResponse.number(1);
            }
            case "HINCRBY" -> FakeResponse.number(hincr(a.get(0), a.get(1), Long.parseLong(a.get(2))));
            case "GET" -> FakeResponse.bulk(strings.get(a.get(0)));
            case "SET" -> {
                strings.put(a.get(0), a.get(1));
                yield FakeResponse.simple("OK");
            }
            case "SMEMBERS" -> FakeResponse.array(sets.getOrDefault(a.get(0), Set.of()).stream()
                    .map(FakeResponse::bulk).toList());
            case "SADD" -> FakeResponse.number(sets.computeIfAbsent(a.get(0), k -> new LinkedHashSet<>())
                    .add(a.get(1)) ? 1 : 0);
            case "SREM" -> FakeResponse.number(sets.getOrDefault(a.get(0), new LinkedHashSet<>()).remove(a.get(1))
                    ? 1 : 0);
            case "ZADD" -> {
                int i = 1;
                while (a.get(i).equalsIgnoreCase("XX") || a.get(i).equalsIgnoreCase("NX")) {
                    i++;
                }
                zsets.computeIfAbsent(a.get(0), k -> new HashMap<>()).put(a.get(i + 1), Double.parseDouble(a.get(i)));
                yield FakeResponse.number(1);
            }
            case "ZREM" -> FakeResponse.number(zsets.getOrDefault(a.get(0), new HashMap<>()).remove(a.get(1)) != null
                    ? 1 : 0);
            case "ZSCORE" -> {
                Double s = zsets.getOrDefault(a.get(0), Map.of()).get(a.get(1));
                yield FakeResponse.bulk(s == null ? null : Long.toString(s.longValue()));
            }
            case "EXPIRE", "PEXPIRE", "GEOADD" -> FakeResponse.number(1);
            default -> throw new UnsupportedOperationException("FakeRedis: " + name);
        };
    }

    private Map<String, String> hash(String key) {
        return hashes.getOrDefault(key, new HashMap<>());
    }

    private long hincr(String key, String field, long by) {
        Map<String, String> h = hashes.computeIfAbsent(key, k -> new HashMap<>());
        long v = Long.parseLong(h.getOrDefault(field, "0")) + by;
        h.put(field, Long.toString(v));
        return v;
    }

    /** The scripts this module sends, recognised by what they do; ARGV starts after the keys. */
    private Response eval(List<String> a) {
        String script = a.get(0);
        int nkeys = Integer.parseInt(a.get(1));
        List<String> keys = a.subList(2, 2 + nkeys);
        List<String> argv = a.subList(2 + nkeys, a.size());
        if (script.contains("'close:revision') or '0'")) {
            count("EVAL episodes.save");
            return saveEpisodes(keys, argv);
        }
        if (script.contains("HINCRBY', KEYS[1], 'close:revision', 1)") && script.contains("HKEYS")) {
            count("EVAL episodes.close");
            hincr(keys.get(0), "close:revision", 1);
            if (argv.get(3).isEmpty()) {
                hash(keys.get(0)).remove(argv.get(2));
            } else {
                hashes.computeIfAbsent(keys.get(0), k -> new HashMap<>()).put(argv.get(2), argv.get(3));
            }
            return FakeResponse.number(1);
        }
        if (script.contains("HINCRBY', KEYS[1], ARGV[2], 1)")) {
            count("EVAL duty.write");
            if (argv.get(2).isEmpty()) {
                hincr(keys.get(0), argv.get(1), 1);
            } else {
                hashes.computeIfAbsent(keys.get(0), k -> new HashMap<>()).put(argv.get(1), argv.get(2));
            }
            return FakeResponse.number(1);
        }
        if (script.contains("LPUSH")) {
            count("EVAL samples.record");
            if (strings.putIfAbsent(keys.get(1), "1") != null) {
                return FakeResponse.number(0);
            }
            List<String> l = lists.computeIfAbsent(keys.get(0), k -> new ArrayList<>());
            l.add(0, argv.get(0));
            while (l.size() > Integer.parseInt(argv.get(1))) {
                l.remove(l.size() - 1);
            }
            return FakeResponse.number(1);
        }
        if (script.contains("HLEN")) {
            count("EVAL event_types.count");
            for (String t : argv.subList(2, argv.size())) {
                hincr(keys.get(0), t, 1);
            }
            return FakeResponse.number(1);
        }
        if (script.contains("ZSCORE', KEYS[2]")) {
            count("EVAL loss.checked");
            return FakeResponse.number(1);
        }
        throw new UnsupportedOperationException("FakeRedis: unknown script");
    }

    private Response saveEpisodes(List<String> keys, List<String> argv) {
        Map<String, String> h = hashes.computeIfAbsent(keys.get(0), k -> new HashMap<>());
        if (!h.getOrDefault("close:revision", "0").equals(argv.get(4))) {
            return FakeResponse.number(0);
        }
        int n = Integer.parseInt(argv.get(1));
        for (int i = 0; i < n; i++) {
            h.put(argv.get(5 + 2 * i), argv.get(6 + 2 * i));
        }
        for (int i = 5 + 2 * n; i < argv.size(); i++) {
            h.remove(argv.get(i));
        }
        if (argv.get(2).equals("1")) {
            sets.computeIfAbsent(keys.get(1), k -> new LinkedHashSet<>()).add(argv.get(3));
        } else {
            sets.getOrDefault(keys.get(1), new LinkedHashSet<>()).remove(argv.get(3));
        }
        return FakeResponse.number(1);
    }

    /** The answers above: a bulk string, a number, an array or a map; a missing value is null. */
    record FakeResponse(ResponseType type, String text, List<Response> items, Map<String, Response> map)
            implements Response {

        static Response bulk(String s) {
            return s == null ? null : new FakeResponse(ResponseType.BULK, s, null, null);
        }

        static Response simple(String s) {
            return new FakeResponse(ResponseType.SIMPLE, s, null, null);
        }

        static Response number(long n) {
            return new FakeResponse(ResponseType.NUMBER, Long.toString(n), null, null);
        }

        static Response array(List<Response> items) {
            return new FakeResponse(ResponseType.MULTI, null, new ArrayList<>(items), null);
        }

        static Response map(Map<String, String> m) {
            Map<String, Response> out = new LinkedHashMap<>();
            m.forEach((k, v) -> out.put(k, bulk(v)));
            return new FakeResponse(ResponseType.MULTI, null, null, out);
        }

        @Override
        public String toString() {
            return text;
        }

        @Override
        public Long toLong() {
            return Long.parseLong(text);
        }

        @Override
        public Integer toInteger() {
            return Integer.parseInt(text);
        }

        @Override
        public Double toDouble() {
            return Double.parseDouble(text);
        }

        @Override
        public Number toNumber() {
            return Double.parseDouble(text);
        }

        @Override
        public Boolean toBoolean() {
            return "1".equals(text) || "true".equalsIgnoreCase(text);
        }

        @Override
        public Response get(int index) {
            return items.get(index);
        }

        @Override
        public Response get(String key) {
            return map.get(key);
        }

        @Override
        public boolean containsKey(String key) {
            return map != null && map.containsKey(key);
        }

        @Override
        public Set<String> getKeys() {
            return map == null ? Set.of() : map.keySet();
        }

        @Override
        public int size() {
            return items != null ? items.size() : map != null ? map.size() : 0;
        }

        @Override
        public boolean isArray() {
            return items != null;
        }

        @Override
        public boolean isMap() {
            return map != null;
        }

        @Override
        public Iterator<Response> iterator() {
            return items != null ? items.iterator() : map != null ? map.values().iterator()
                    : List.<Response>of().iterator();
        }
    }
}

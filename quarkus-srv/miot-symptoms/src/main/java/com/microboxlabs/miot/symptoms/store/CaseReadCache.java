package com.microboxlabs.miot.symptoms.store;

import com.github.benmanes.caffeine.cache.AsyncCache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.microboxlabs.miot.core.db.PgTx;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * The Control Tower's tenant-wide case reads, kept {@code miot.symptoms.control-tower.cache-ttl} per organization,
 * so every open tab of one organization shares one query per period. Concurrent misses on one key wait for the
 * first one's query. A case write through the modulith drops its organization's entries once it commits; writes
 * from elsewhere show after the TTL. Per pod: the modulith runs one replica.
 *
 * <p>Keys always hold the tenant code, and only reads that do not depend on the caller go through here. Inside a
 * {@link PgTx} transaction reads skip the cache, so a transaction sees its own writes.
 */
@ApplicationScoped
public class CaseReadCache {

    /** Reads the store every time. */
    public static final CaseReadCache DISABLED = new CaseReadCache(Duration.ZERO, null);

    static final int MAX_ENTRIES = 1_000;

    private record Key(String tenant, String read, List<Object> args) {
    }

    private final AsyncCache<Key, Object> cache;
    private final Counter hits;
    private final Counter misses;

    @Inject
    public CaseReadCache(
            @ConfigProperty(name = "miot.symptoms.control-tower.cache-ttl", defaultValue = "20S") Duration ttl,
            MeterRegistry meters) {
        this.cache = ttl.isZero() || ttl.isNegative() ? null
                : Caffeine.newBuilder().expireAfterWrite(ttl).maximumSize(MAX_ENTRIES).buildAsync();
        this.hits = meters == null ? null : meters.counter("miot.symptoms.control_tower.cache", "result", "hit");
        this.misses = meters == null ? null : meters.counter("miot.symptoms.control_tower.cache", "result", "miss");
    }

    /** {@code read}'s result for {@code tenant} and {@code args}, from the cache or from {@code load}. */
    @SuppressWarnings("unchecked")
    public <T> T get(String tenant, String read, Supplier<T> load, Object... args) {
        if (cache == null || tenant == null || PgTx.client(null) != null) {
            return load.get();
        }
        Key key = new Key(tenant, read, Arrays.asList(args));
        CompletableFuture<Object> mine = new CompletableFuture<>();
        CompletableFuture<Object> running = cache.asMap().putIfAbsent(key, mine);
        if (running != null) {
            count(hits);
            return (T) join(running);
        }
        count(misses);
        try {
            T value = load.get();
            mine.complete(value);
            return value;
        } catch (RuntimeException | Error e) {
            // Caffeine drops a failed future; the callers waiting on it get the same failure.
            mine.completeExceptionally(e);
            cache.asMap().remove(key, mine);
            throw e;
        }
    }

    /** Drops {@code tenant}'s entries once the open transaction commits, or now outside one; null drops all. */
    public void invalidateAfterCommit(String tenant) {
        if (cache != null) {
            PgTx.afterCommit(() -> invalidate(tenant));
        }
    }

    /** Drops {@code tenant}'s entries, including a query still running; null drops every organization's. */
    public void invalidate(String tenant) {
        if (cache == null) {
            return;
        }
        if (tenant == null) {
            cache.synchronous().invalidateAll();
        } else {
            cache.asMap().keySet().removeIf(k -> Objects.equals(k.tenant(), tenant));
        }
    }

    private static Object join(CompletableFuture<Object> running) {
        try {
            return running.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted waiting for a cached read", e);
        } catch (ExecutionException | CompletionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException r) {
                throw r;
            }
            if (cause instanceof Error err) {
                throw err;
            }
            throw new IllegalStateException(cause);
        }
    }

    private static void count(Counter counter) {
        if (counter != null) {
            counter.increment();
        }
    }
}

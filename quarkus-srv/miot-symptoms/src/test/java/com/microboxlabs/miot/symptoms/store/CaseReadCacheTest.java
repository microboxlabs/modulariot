package com.microboxlabs.miot.symptoms.store;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class CaseReadCacheTest {

    private final CaseReadCache cache = new CaseReadCache(Duration.ofSeconds(20), null);

    private static Supplier<Integer> counting(AtomicInteger calls) {
        return calls::incrementAndGet;
    }

    @Test
    void twoReadsWithinTheTtlRunOneQuery() {
        AtomicInteger calls = new AtomicInteger();

        assertEquals(1, cache.get("tenant-a", "openCounts", counting(calls)));
        assertEquals(1, cache.get("tenant-a", "openCounts", counting(calls)));
        assertEquals(1, calls.get());
    }

    @Test
    void theParameterIsPartOfTheKey() {
        AtomicInteger calls = new AtomicInteger();

        cache.get("tenant-a", "towerCounts", counting(calls), "REQUIRED");
        cache.get("tenant-a", "towerCounts", counting(calls), "ALL");
        cache.get("tenant-a", "towerCounts", counting(calls), "REQUIRED");
        cache.get("tenant-a", "openLevels", counting(calls), "REQUIRED");
        assertEquals(3, calls.get());
    }

    @Test
    void tenantsNeverShareAResult() {
        assertEquals("a", cache.get("tenant-a", "openCounts", () -> "a"));
        assertEquals("b", cache.get("tenant-b", "openCounts", () -> "b"));
        assertEquals("a", cache.get("tenant-a", "openCounts", () -> "other"));
    }

    @Test
    void concurrentMissesOnOneKeyRunOneQuery() throws Exception {
        SimpleMeterRegistry meters = new SimpleMeterRegistry();
        CaseReadCache shared = new CaseReadCache(Duration.ofSeconds(20), meters);
        AtomicInteger calls = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        Supplier<Integer> slow = () -> {
            calls.incrementAndGet();
            started.countDown();
            try {
                assertTrue(release.await(10, TimeUnit.SECONDS));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return 42;
        };
        ExecutorService threads = Executors.newFixedThreadPool(8);
        try {
            List<Future<Integer>> reads = new ArrayList<>();
            reads.add(threads.submit(() -> shared.get("tenant-a", "towerCounts", slow, "REQUIRED")));
            assertTrue(started.await(10, TimeUnit.SECONDS));
            for (int i = 0; i < 7; i++) {
                reads.add(threads.submit(() -> shared.get("tenant-a", "towerCounts", slow, "REQUIRED")));
            }
            await().atMost(Duration.ofSeconds(10)).until(() ->
                    meters.counter("miot.symptoms.control_tower.cache", "result", "hit").count() == 7);
            release.countDown();
            for (Future<Integer> read : reads) {
                assertEquals(42, read.get(10, TimeUnit.SECONDS));
            }
        } finally {
            threads.shutdownNow();
        }
        assertEquals(1, calls.get());
    }

    @Test
    void invalidatingATenantKeepsTheOthers() {
        AtomicInteger a = new AtomicInteger();
        AtomicInteger b = new AtomicInteger();
        cache.get("tenant-a", "openCounts", counting(a));
        cache.get("tenant-a", "towerCounts", counting(a), "REQUIRED");
        cache.get("tenant-b", "openCounts", counting(b));

        cache.invalidateAfterCommit("tenant-a");

        cache.get("tenant-a", "openCounts", counting(a));
        cache.get("tenant-a", "towerCounts", counting(a), "REQUIRED");
        cache.get("tenant-b", "openCounts", counting(b));
        assertEquals(4, a.get(), "tenant A reads the store again");
        assertEquals(1, b.get(), "tenant B keeps its entry");
    }

    @Test
    void invalidatingWithoutATenantDropsEveryOrganization() {
        AtomicInteger calls = new AtomicInteger();
        cache.get("tenant-a", "openCounts", counting(calls));
        cache.get("tenant-b", "openCounts", counting(calls));

        cache.invalidate(null);

        cache.get("tenant-a", "openCounts", counting(calls));
        cache.get("tenant-b", "openCounts", counting(calls));
        assertEquals(4, calls.get());
    }

    @Test
    void aReadStillRunningWhenItsTenantIsInvalidatedIsNotKept() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService thread = Executors.newSingleThreadExecutor();
        try {
            Future<Integer> stale = thread.submit(() -> cache.get("tenant-a", "openCounts", () -> {
                calls.incrementAndGet();
                started.countDown();
                try {
                    assertTrue(release.await(10, TimeUnit.SECONDS));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return 1;
            }));
            assertTrue(started.await(10, TimeUnit.SECONDS));
            cache.invalidate("tenant-a");
            release.countDown();
            assertEquals(1, stale.get(10, TimeUnit.SECONDS));
        } finally {
            thread.shutdownNow();
        }

        assertEquals(2, cache.get("tenant-a", "openCounts", counting(calls)));
    }

    @Test
    void entriesExpireAfterTheTtl() {
        AtomicLong nanos = new AtomicLong();
        CaseReadCache shortLived = new CaseReadCache(Duration.ofSeconds(20), null, nanos::get);
        AtomicInteger calls = new AtomicInteger();
        shortLived.get("tenant-a", "openCounts", counting(calls));
        nanos.set(Duration.ofSeconds(19).toNanos());
        shortLived.get("tenant-a", "openCounts", counting(calls));
        assertEquals(1, calls.get(), "hits do not extend the TTL");
        nanos.set(Duration.ofSeconds(20).toNanos());
        shortLived.get("tenant-a", "openCounts", counting(calls));
        assertEquals(2, calls.get());
    }

    @Test
    void zeroSecondsDisablesTheCache() {
        CaseReadCache off = new CaseReadCache(Duration.ZERO, null);
        AtomicInteger calls = new AtomicInteger();

        off.get("tenant-a", "openCounts", counting(calls));
        off.get("tenant-a", "openCounts", counting(calls));
        off.invalidateAfterCommit("tenant-a");
        assertEquals(2, calls.get());
    }

    @Test
    void aFailedReadIsNotKeptAndReachesTheCaller() {
        IllegalStateException down = new IllegalStateException("database unavailable");
        assertSame(down, assertThrows(IllegalStateException.class,
                () -> cache.get("tenant-a", "openCounts", () -> {
                    throw down;
                })));
        assertEquals(7, cache.get("tenant-a", "openCounts", () -> 7));
    }

    @Test
    void anErrorReleasesWaitersAndIsNotKept() throws Exception {
        SimpleMeterRegistry meters = new SimpleMeterRegistry();
        CaseReadCache shared = new CaseReadCache(Duration.ofSeconds(20), meters);
        AssertionError failure = new AssertionError("load failed");
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        try (ExecutorService threads = Executors.newFixedThreadPool(2)) {
            Future<Integer> owner = threads.submit(() -> shared.get("tenant-a", "openCounts", () -> {
                started.countDown();
                try {
                    assertTrue(release.await(10, TimeUnit.SECONDS));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                throw failure;
            }));
            assertTrue(started.await(10, TimeUnit.SECONDS));
            Future<Integer> waiter = threads.submit(() -> shared.get("tenant-a", "openCounts", () -> 99));
            try {
                await().atMost(Duration.ofSeconds(10)).until(() ->
                        meters.counter("miot.symptoms.control_tower.cache", "result", "hit").count() == 1);
            } finally {
                release.countDown();
            }
            assertSame(failure, assertThrows(ExecutionException.class,
                    () -> owner.get(10, TimeUnit.SECONDS)).getCause());
            assertSame(failure, assertThrows(ExecutionException.class,
                    () -> waiter.get(10, TimeUnit.SECONDS)).getCause());
        }
        assertEquals(7, shared.get("tenant-a", "openCounts", () -> 7));
    }

    @Test
    void hitsAndMissesAreCounted() {
        SimpleMeterRegistry meters = new SimpleMeterRegistry();
        CaseReadCache measured = new CaseReadCache(Duration.ofSeconds(20), meters);

        measured.get("tenant-a", "openCounts", () -> 1);
        measured.get("tenant-a", "openCounts", () -> 1);
        measured.get("tenant-a", "openCounts", () -> 1);

        assertEquals(2.0, meters.counter("miot.symptoms.control_tower.cache", "result", "hit").count());
        assertEquals(1.0, meters.counter("miot.symptoms.control_tower.cache", "result", "miss").count());
    }
}

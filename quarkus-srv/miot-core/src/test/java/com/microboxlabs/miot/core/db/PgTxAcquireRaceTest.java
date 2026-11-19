package com.microboxlabs.miot.core.db;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.mutiny.sqlclient.Pool;
import java.lang.reflect.Proxy;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class PgTxAcquireRaceTest {

    @Test
    void connectionDeliveredWhileRestoringInterruptIsClosed() throws Exception {
        Promise<io.vertx.sqlclient.SqlConnection> pending = Promise.promise();
        AtomicBoolean closed = new AtomicBoolean();
        var connection = connection(closed);
        CountDownLatch acquiring = new CountDownLatch(1);
        Pool pool = pool(pending, acquiring);
        CompletableFuture<Boolean> interrupted = new CompletableFuture<>();
        Thread waiter = new Thread(() -> {
            try {
                assertThrows(IllegalStateException.class, () -> PgTx.acquire(pool, Duration.ofSeconds(10)));
                interrupted.complete(Thread.currentThread().isInterrupted());
            } catch (Throwable failure) {
                interrupted.completeExceptionally(failure);
            }
        }) {
            private final AtomicInteger interrupts = new AtomicInteger();

            @Override
            public void interrupt() {
                int count = interrupts.incrementAndGet();
                super.interrupt();
                // Complete between get() throwing InterruptedException and acquire() abandoning the wait.
                if (count == 2) {
                    pending.complete(connection);
                }
            }
        };
        waiter.start();
        try {
            assertTrue(acquiring.await(5, TimeUnit.SECONDS));
            waiter.interrupt();
            assertTrue(interrupted.get(5, TimeUnit.SECONDS), "preserves the caller's interrupt flag");
            assertTrue(closed.get(), "the connection delivered to an interrupted caller must return to the pool");
        } finally {
            waiter.interrupt();
            waiter.join(5000);
        }
        assertFalse(waiter.isAlive());
    }

    @Test
    void connectionDeliveredAfterTimeoutIsClosed() {
        Promise<io.vertx.sqlclient.SqlConnection> pending = Promise.promise();
        AtomicBoolean closed = new AtomicBoolean();
        Pool pool = pool(pending, new CountDownLatch(1));

        assertThrows(io.smallrye.mutiny.TimeoutException.class,
                () -> PgTx.acquire(pool, Duration.ofMillis(10)));
        pending.complete(connection(closed));

        assertTrue(closed.get(), "a late connection must return to the pool");
    }

    private static io.vertx.sqlclient.SqlConnection connection(AtomicBoolean closed) {
        return (io.vertx.sqlclient.SqlConnection) Proxy.newProxyInstance(PgTxAcquireRaceTest.class.getClassLoader(),
                new Class<?>[]{io.vertx.sqlclient.SqlConnection.class}, (proxy, method, args) -> {
                    if (method.getName().equals("close")) {
                        closed.set(true);
                        return Future.succeededFuture();
                    }
                    throw new UnsupportedOperationException(method.getName());
                });
    }

    private static Pool pool(Promise<io.vertx.sqlclient.SqlConnection> pending, CountDownLatch acquiring) {
        var delegate = (io.vertx.sqlclient.Pool) Proxy.newProxyInstance(PgTxAcquireRaceTest.class.getClassLoader(),
                new Class<?>[]{io.vertx.sqlclient.Pool.class}, (proxy, method, args) -> {
                    if (method.getName().equals("getConnection")) {
                        acquiring.countDown();
                        return pending.future();
                    }
                    throw new UnsupportedOperationException(method.getName());
                });
        return Pool.newInstance(delegate);
    }
}

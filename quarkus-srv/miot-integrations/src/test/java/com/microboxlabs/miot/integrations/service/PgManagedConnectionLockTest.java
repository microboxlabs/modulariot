package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.persistence.ManagedProvisioningTransaction;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named = "miot.integrations.test.pg-url", matches = ".+")
class PgManagedConnectionLockTest {
    @Test
    void serializesTheSameTenantAcrossInstancesAndReleasesOnFailure() throws Exception {
        Vertx vertx = Vertx.vertx();
        Pool pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.integrations.test.pg-url")))
                .with(new PoolOptions().setMaxSize(3)).using(vertx).build();
        ManagedConnectionLock first = new ManagedConnectionLock(() -> pool);
        ManagedConnectionLock second = new ManagedConnectionLock(() -> pool);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        try (var workers = Executors.newFixedThreadPool(2)) {
            var one = workers.submit(() -> first.locked("cert-managed-a", () -> {
                entered.countDown();
                try {
                    assertTrue(release.await(5, TimeUnit.SECONDS));
                } catch (InterruptedException cause) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(cause);
                }
                return 1;
            }));
            try {
                assertTrue(entered.await(5, TimeUnit.SECONDS));
                var two = workers.submit(() -> second.locked("cert-managed-a", () -> 2));
                assertThrows(TimeoutException.class, () -> two.get(100, TimeUnit.MILLISECONDS));
                assertEquals(3, second.locked("cert-managed-b", () -> 3));
                release.countDown();
                assertEquals(1, one.get(5, TimeUnit.SECONDS));
                assertEquals(2, two.get(5, TimeUnit.SECONDS));
                assertThrows(IllegalStateException.class, () -> first.locked("cert-managed-a", () -> {
                    throw new IllegalStateException("Synthetic persistence failure");
                }));
                assertEquals(4, second.locked("cert-managed-a", () -> 4));
            } finally {
                release.countDown();
            }
        } finally {
            pool.closeAndAwait();
            vertx.closeAndAwait();
        }
    }

    @Test
    void usesOneConnectionAndRollsBackProvisioningWrites() {
        Vertx vertx = Vertx.vertx();
        Pool pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.integrations.test.pg-url")))
                .with(new PoolOptions().setMaxSize(1)).using(vertx).build();
        try {
            pool.query("CREATE TEMP TABLE cert_managed_lock (id INT)").execute().await().indefinitely();
            ManagedConnectionLock lock = new ManagedConnectionLock(() -> pool);
            assertThrows(IllegalStateException.class, () -> lock.locked("cert-managed-single", () -> {
                ManagedProvisioningTransaction.client(pool).query("INSERT INTO cert_managed_lock VALUES (1)")
                        .execute().await().indefinitely();
                throw new IllegalStateException("Synthetic failure after a credential write");
            }));
            assertEquals(0L, pool.query("SELECT count(*) FROM cert_managed_lock").execute().await().indefinitely()
                    .iterator().next().getLong(0));
            assertEquals(1L, lock.locked("cert-managed-single", () -> {
                ManagedProvisioningTransaction.client(pool).query("INSERT INTO cert_managed_lock VALUES (2)")
                        .execute().await().indefinitely();
                return ManagedProvisioningTransaction.client(pool).query("SELECT count(*) FROM cert_managed_lock")
                        .execute().await().indefinitely().iterator().next().getLong(0);
            }));
        } finally {
            pool.closeAndAwait();
            vertx.closeAndAwait();
        }
    }
}

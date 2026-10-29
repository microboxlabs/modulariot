package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.persistence.ManagedProvisioningTransaction;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.Optional;
import java.util.function.Supplier;

/** A transaction lock shared by replicas. Contenders release their connection before retrying. */
@ApplicationScoped
public class ManagedConnectionLock {
    private static final String LOCK =
            "SELECT pg_try_advisory_xact_lock(hashtext('miot_integrations.managed_bigquery'), hashtext($1))";
    private static final long WAIT_NANOS = Duration.ofSeconds(10).toNanos();
    private final Supplier<Pool> pool;

    @Inject
    public ManagedConnectionLock(Instance<Pool> pool) {
        this(pool::get);
    }

    ManagedConnectionLock(Supplier<Pool> pool) {
        this.pool = pool;
    }

    public <T> T locked(String tenantCode, Supplier<T> work) {
        long started = System.nanoTime();
        for (;;) {
            Optional<T> result = pool.get().withTransaction(connection ->
                    connection.preparedQuery(LOCK).execute(Tuple.of(tenantCode)).flatMap(rows -> {
                        if (!rows.iterator().next().getBoolean(0)) return Uni.createFrom().item(Optional.<T>empty());
                        // Blocking repository calls run on this transaction connection, never on the event loop.
                        return Uni.createFrom().item(() -> Optional.of(ManagedProvisioningTransaction.run(connection, work)))
                                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
                    })).await().indefinitely();
            if (result.isPresent()) return result.get();
            if (System.nanoTime() - started >= WAIT_NANOS) {
                throw new IllegalStateException("Managed connection provisioning is busy; retry later");
            }
            pause();
        }
    }

    private static void pause() {
        try {
            Thread.sleep(25);
        } catch (InterruptedException cause) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Managed connection provisioning was interrupted", cause);
        }
    }
}

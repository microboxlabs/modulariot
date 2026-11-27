package com.microboxlabs.miot.teltonika.store;

import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.function.Supplier;

/**
 * {@link ClusterLock} with a PostgreSQL transaction-scoped advisory lock, as the places sync does:
 * a separate transaction pins the lock while the job runs on the pool's other connections.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class PgClusterLock implements ClusterLock {

    private final Supplier<Pool> pool;

    @Inject
    PgClusterLock(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgClusterLock(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public boolean runExclusively(String job, Runnable work) {
        var connection = pool.get().getConnection().await().atMost(PgSupport.TIMEOUT);
        try {
            var tx = connection.begin().await().atMost(PgSupport.TIMEOUT);
            try {
                boolean held = connection.preparedQuery("SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0))")
                        .execute(Tuple.of("miot_teltonika." + job)).await().atMost(PgSupport.TIMEOUT)
                        .iterator().next().getBoolean(0);
                if (held) {
                    work.run();
                }
                return held;
            } finally {
                tx.rollback().await().atMost(PgSupport.TIMEOUT);
            }
        } finally {
            connection.close().await().atMost(PgSupport.TIMEOUT);
        }
    }
}

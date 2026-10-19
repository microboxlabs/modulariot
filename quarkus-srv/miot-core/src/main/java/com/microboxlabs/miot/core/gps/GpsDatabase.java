package com.microboxlabs.miot.core.gps;

import io.quarkus.arc.InjectableInstance;
import io.quarkus.reactive.datasource.ReactiveDataSource;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * The GPS database ({@code prod_iot_gps}): the named reactive datasource {@code gps}, shared by every component.
 * Inactive while {@code quarkus.datasource.gps.reactive.url} is unset.
 */
@ApplicationScoped
public class GpsDatabase {

    /** Opens a read-only transaction; the pool's login can write. */
    public static final String READ_ONLY = "SET TRANSACTION READ ONLY";

    private final InjectableInstance<Pool> pool;

    GpsDatabase(@ReactiveDataSource("gps") InjectableInstance<Pool> pool) {
        this.pool = pool;
    }

    public boolean configured() {
        return pool.getHandle().getBean().isActive();
    }

    public Pool pool() {
        return pool.get();
    }

    /** One statement in a read-only transaction. */
    public static Uni<RowSet<Row>> read(Pool pool, String sql, Tuple params) {
        return pool.withTransaction(conn -> conn.query(READ_ONLY).execute()
                .chain(() -> conn.preparedQuery(sql).execute(params)));
    }
}

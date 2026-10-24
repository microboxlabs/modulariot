package com.microboxlabs.miot.core.db;

import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.function.Supplier;

/** {@link Transactions} on the modulith database pool. */
@ApplicationScoped
public class PgTransactions implements Transactions {

    private final Supplier<Pool> pool;

    @Inject
    PgTransactions(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgTransactions(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public <T> T inTransaction(Supplier<T> work) {
        return PgTx.inTransaction(pool.get(), work);
    }
}

package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.service.Transactions;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.function.Supplier;

@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
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
        return Pg.inTransaction(pool.get(), work);
    }
}

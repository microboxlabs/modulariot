package com.microboxlabs.miot.integrations.service;

import jakarta.enterprise.inject.Vetoed;
import java.util.function.Supplier;

/** In-memory repository fixtures; PostgreSQL serialization is covered by PgManagedConnectionLockTest. */
@Vetoed
public final class TestManagedConnectionLock extends ManagedConnectionLock {
    public TestManagedConnectionLock() {
        super(() -> null);
    }

    public static ManagedConnectionLock forPool(io.vertx.mutiny.sqlclient.Pool pool) {
        return new ManagedConnectionLock(() -> pool);
    }

    @Override
    public <T> T locked(String tenantCode, Supplier<T> work) {
        return work.get();
    }
}

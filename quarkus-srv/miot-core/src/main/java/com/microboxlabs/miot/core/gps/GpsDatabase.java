package com.microboxlabs.miot.core.gps;

import io.quarkus.arc.InjectableInstance;
import io.quarkus.reactive.datasource.ReactiveDataSource;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * The GPS database ({@code prod_iot_gps}) through two named reactive datasources with the same login:
 * {@code gps} for symptom processing, retransmit and the sharing sync, and {@code gps-read} for screens and
 * reports, whose sessions are read only. Not configured while the URL or the username is unset.
 */
@ApplicationScoped
public class GpsDatabase {

    private final InjectableInstance<Pool> pool;
    private final InjectableInstance<Pool> readPool;
    private final boolean hasUser;

    GpsDatabase(@ReactiveDataSource("gps") InjectableInstance<Pool> pool,
            @ReactiveDataSource("gps-read") InjectableInstance<Pool> readPool,
            @ConfigProperty(name = "quarkus.datasource.gps.username") Optional<String> username) {
        this.pool = pool;
        this.readPool = readPool;
        this.hasUser = username.filter(u -> !u.isBlank()).isPresent();
    }

    public boolean configured() {
        return hasUser && pool.getHandle().getBean().isActive();
    }

    public Pool pool() {
        return pool.get();
    }

    /** Read-only sessions. */
    public Pool readPool() {
        return readPool.get();
    }
}

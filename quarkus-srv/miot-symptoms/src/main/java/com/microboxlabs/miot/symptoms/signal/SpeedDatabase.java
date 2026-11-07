package com.microboxlabs.miot.symptoms.signal;

import io.quarkus.runtime.ShutdownEvent;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import java.util.Optional;

/**
 * The legacy speed database: OSM road limits and an organization's own speed polygons, read by the signal builder.
 * A login of its own on its own database, so a reactive pool built here, with read-only sessions. Not configured
 * while the host, the database or the username is unset.
 */
@ApplicationScoped
public class SpeedDatabase {

    @ConfigMapping(prefix = "miot.speed.db")
    public interface Settings {
        Optional<String> host();

        @WithDefault("5432")
        int port();

        Optional<String> name();

        Optional<String> username();

        Optional<String> password();

        @WithDefault("2")
        int maxSize();
    }

    private final Settings settings;
    private final Vertx vertx;
    private volatile Pool pool;

    SpeedDatabase(Settings settings, Vertx vertx) {
        this.settings = settings;
        this.vertx = vertx;
    }

    public boolean configured() {
        return present(settings.host()) && present(settings.name()) && present(settings.username());
    }

    /** Read-only sessions; created on first use. Only when {@link #configured()}. */
    public Pool pool() {
        if (!configured()) {
            throw new IllegalStateException("The speed database is not configured");
        }
        Pool p = pool;
        if (p == null) {
            synchronized (this) {
                if (pool == null) {
                    pool = PgBuilder.pool().connectingTo(options(settings))
                            .with(new PoolOptions().setMaxSize(settings.maxSize()).setIdleTimeout(60)
                                    .setName("miot-speed"))
                            .using(vertx).build();
                }
                p = pool;
            }
        }
        return p;
    }

    static PgConnectOptions options(Settings s) {
        return new PgConnectOptions().setHost(s.host().orElseThrow()).setPort(s.port())
                .setDatabase(s.name().orElseThrow()).setUser(s.username().orElseThrow())
                .setPassword(s.password().orElse(null)).setReconnectAttempts(10).setReconnectInterval(500)
                .addProperty("application_name", "miot-modulith-speed")
                .addProperty("default_transaction_read_only", "on");
    }

    void onStop(@Observes ShutdownEvent ignored) {
        Pool p = pool;
        if (p != null) {
            p.closeAndAwait();
        }
    }

    private static boolean present(Optional<String> value) {
        return value.filter(v -> !v.isBlank()).isPresent();
    }
}

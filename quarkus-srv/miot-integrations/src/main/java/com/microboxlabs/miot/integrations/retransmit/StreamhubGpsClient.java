package com.microboxlabs.miot.integrations.retransmit;

import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.pgclient.PgPool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Optional client to StreamHub GPS Postgres ({@code prod_iot_gps}) for retransmit
 * SQL ({@code process_enriched_position_retransmit}). Built only when the worker
 * is enabled and a GPS reactive URL is configured — keeps the default modulith
 * datasource on the control-plane {@code miot} database.
 */
@ApplicationScoped
public class StreamhubGpsClient {

    private static final Logger LOG = Logger.getLogger(StreamhubGpsClient.class);

    private static final String PROCESS_SQL =
            "SELECT public.process_enriched_position_retransmit($1::jsonb) AS result";

    private final boolean workerEnabled;
    private final Optional<String> reactiveUrl;
    private final Optional<String> username;
    private final Optional<String> password;
    private volatile PgPool pool;

    StreamhubGpsClient(
            @ConfigProperty(name = "miot.integrations.retransmit.worker.enabled", defaultValue = "false")
                    boolean workerEnabled,
            @ConfigProperty(name = "miot.integrations.retransmit.gps.reactive-url")
                    Optional<String> reactiveUrl,
            @ConfigProperty(name = "miot.integrations.retransmit.gps.username")
                    Optional<String> username,
            @ConfigProperty(name = "miot.integrations.retransmit.gps.password")
                    Optional<String> password) {
        this.workerEnabled = workerEnabled;
        this.reactiveUrl = reactiveUrl;
        this.username = username;
        this.password = password;
    }

    public boolean isConfigured() {
        return workerEnabled
                && reactiveUrl.filter(u -> !u.isBlank()).isPresent()
                && username.filter(u -> !u.isBlank()).isPresent();
    }

    public JsonObject processEnrichedPosition(JsonObject enriched) {
        ensurePool();
        var row = pool.preparedQuery(PROCESS_SQL)
                .execute(Tuple.of(enriched))
                .await().indefinitely()
                .iterator()
                .next();
        JsonObject result = row.getJsonObject("result");
        return result == null ? new JsonObject() : result;
    }

    private void ensurePool() {
        if (pool != null) {
            return;
        }
        synchronized (this) {
            if (pool != null) {
                return;
            }
            if (!isConfigured()) {
                throw new IllegalStateException(
                        "Retransmit GPS datasource is not configured "
                                + "(set miot.integrations.retransmit.gps.reactive-url / username)");
            }
            String url = reactiveUrl.orElseThrow();
            // Accept postgresql://host:port/db or host:port/db
            String normalized = url.startsWith("postgresql://")
                    ? url.substring("postgresql://".length())
                    : url.startsWith("postgres://")
                            ? url.substring("postgres://".length())
                            : url;
            String hostPortDb = normalized;
            String host = "localhost";
            int port = 5432;
            String database = "prod_iot_gps";
            int slash = hostPortDb.indexOf('/');
            String hostPort = slash >= 0 ? hostPortDb.substring(0, slash) : hostPortDb;
            if (slash >= 0 && slash + 1 < hostPortDb.length()) {
                database = hostPortDb.substring(slash + 1);
                int q = database.indexOf('?');
                if (q >= 0) {
                    database = database.substring(0, q);
                }
            }
            int colon = hostPort.lastIndexOf(':');
            if (colon > 0) {
                host = hostPort.substring(0, colon);
                port = Integer.parseInt(hostPort.substring(colon + 1));
            } else if (!hostPort.isBlank()) {
                host = hostPort;
            }

            PgConnectOptions connect = new PgConnectOptions()
                    .setHost(host)
                    .setPort(port)
                    .setDatabase(database)
                    .setUser(username.orElse("streamhub"))
                    .setPassword(password.orElse(""));
            pool = PgPool.pool(connect, new PoolOptions().setMaxSize(4));
            LOG.infof("Retransmit GPS pool ready — %s:%d/%s", host, port, database);
        }
    }

    @PreDestroy
    void close() {
        if (pool != null) {
            try {
                pool.close().await().indefinitely();
            } catch (Exception e) {
                LOG.warn("Error closing retransmit GPS pool", e);
            }
        }
    }
}

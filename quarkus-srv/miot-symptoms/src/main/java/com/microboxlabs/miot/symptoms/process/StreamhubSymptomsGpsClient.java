package com.microboxlabs.miot.symptoms.process;

import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Vert.x pool to StreamHub GPS Postgres ({@code prod_iot_gps}) for
 * {@code process_symptoms_*}. Separate from the modulith control-plane
 * datasource — same idea as {@code StreamhubGpsClient} in integrations.
 */
@ApplicationScoped
public class StreamhubSymptomsGpsClient implements FunctionInvoker {

    private static final Logger LOG = Logger.getLogger(StreamhubSymptomsGpsClient.class);
    private static final Pattern FUNCTION_NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

    private final Vertx vertx;
    private final Optional<String> reactiveUrl;
    private final Optional<String> username;
    private final Optional<String> password;
    private final int maxSize;
    private volatile Pool pool;

    StreamhubSymptomsGpsClient(
            Vertx vertx,
            @ConfigProperty(name = "miot.symptoms.gps.reactive-url") Optional<String> reactiveUrl,
            @ConfigProperty(name = "miot.symptoms.gps.username") Optional<String> username,
            @ConfigProperty(name = "miot.symptoms.gps.password") Optional<String> password,
            @ConfigProperty(name = "miot.symptoms.gps.pool-max-size", defaultValue = "8") int maxSize) {
        this.vertx = vertx;
        this.reactiveUrl = reactiveUrl;
        this.username = username;
        this.password = password;
        this.maxSize = maxSize;
    }

    public boolean isConfigured() {
        return reactiveUrl.filter(u -> !u.isBlank()).isPresent()
                && username.filter(u -> !u.isBlank()).isPresent();
    }

    @Override
    public Uni<JsonObject> invoke(String functionName, JsonObject debeziumPayload) {
        if (!FUNCTION_NAME.matcher(functionName).matches()) {
            return Uni.createFrom()
                    .failure(new IllegalArgumentException("illegal function name: " + functionName));
        }
        String sql = "SELECT * FROM " + functionName + "($1::jsonb)";
        JsonArray arg = new JsonArray().add(new JsonObject().put("message", debeziumPayload));
        return execute(sql, arg)
                .onFailure(this::isLostConnection)
                .recoverWithUni(err -> {
                    LOG.warnf(err, "GPS connection lost, recreating pool and retrying %s", functionName);
                    resetPool();
                    return execute(sql, arg);
                });
    }

    private Uni<JsonObject> execute(String sql, JsonArray arg) {
        try {
            ensurePool();
        } catch (RuntimeException e) {
            return Uni.createFrom().failure(e);
        }
        return pool.preparedQuery(sql)
                .execute(Tuple.of(arg))
                .onItem()
                .transform(rows -> {
                    if (!rows.iterator().hasNext()) {
                        throw new IllegalStateException("No result from function");
                    }
                    Row row = rows.iterator().next();
                    Object value = row.getValue(0);
                    if (value instanceof JsonObject json) {
                        return json;
                    }
                    if (value == null) {
                        throw new IllegalStateException("Null result from function");
                    }
                    return new JsonObject(value.toString());
                });
    }

    private boolean isLostConnection(Throwable err) {
        for (Throwable t = err; t != null; t = t.getCause()) {
            String name = t.getClass().getName();
            if (name.contains("ClosedConnectionException") || name.contains("ConnectException")) {
                return true;
            }
            String msg = t.getMessage();
            if (msg != null
                    && (msg.contains("underlying connection")
                            || msg.contains("Connection refused")
                            || msg.contains("Connection reset"))) {
                return true;
            }
        }
        return false;
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
                        "Symptoms GPS datasource is not configured "
                                + "(set miot.symptoms.gps.reactive-url / username)");
            }
            ParsedUrl parsed = parseUrl(reactiveUrl.orElseThrow());
            PgConnectOptions connect = new PgConnectOptions()
                    .setHost(parsed.host)
                    .setPort(parsed.port)
                    .setDatabase(parsed.database)
                    .setUser(username.orElse("streamhub"))
                    .setPassword(password.orElse(""))
                    .setReconnectAttempts(10)
                    .setReconnectInterval(500)
                    .setIdleTimeout(60)
                    .setIdleTimeoutUnit(TimeUnit.SECONDS);
            pool = PgBuilder.pool()
                    .with(new PoolOptions()
                            .setMaxSize(maxSize)
                            .setIdleTimeout(60)
                            .setIdleTimeoutUnit(TimeUnit.SECONDS)
                            .setPoolCleanerPeriod(15_000))
                    .connectingTo(connect)
                    .using(vertx)
                    .build();
            LOG.infof("Symptoms GPS pool ready — %s:%d/%s (max %d)", parsed.host, parsed.port, parsed.database, maxSize);
        }
    }

    static ParsedUrl parseUrl(String url) {
        String normalized = url.startsWith("postgresql://")
                ? url.substring("postgresql://".length())
                : url.startsWith("postgres://") ? url.substring("postgres://".length()) : url;
        int slash = normalized.indexOf('/');
        int at = normalized.lastIndexOf('@');
        if (at >= 0 && (slash < 0 || at < slash)) {
            normalized = normalized.substring(at + 1);
            slash = normalized.indexOf('/');
        }
        String host = "localhost";
        int port = 5432;
        String database = "prod_iot_gps";
        String hostPort = slash >= 0 ? normalized.substring(0, slash) : normalized;
        if (slash >= 0 && slash + 1 < normalized.length()) {
            database = normalized.substring(slash + 1);
            int q = database.indexOf('?');
            if (q >= 0) {
                database = database.substring(0, q);
            }
        }
        int colon = hostPort.lastIndexOf(':');
        if (colon > 0) {
            host = hostPort.substring(0, colon);
            String portText = hostPort.substring(colon + 1);
            try {
                port = Integer.parseInt(portText);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("invalid GPS datasource port: " + portText);
            }
        } else if (!hostPort.isBlank()) {
            host = hostPort;
        }
        return new ParsedUrl(host, port, database);
    }

    private void resetPool() {
        Pool old;
        synchronized (this) {
            old = pool;
            pool = null;
        }
        if (old != null) {
            old.close().subscribe().with(
                    ok -> {},
                    err -> LOG.warn("Error closing stale GPS pool", err));
        }
    }

    @PreDestroy
    void close() {
        resetPool();
    }

    record ParsedUrl(String host, int port, String database) {}
}

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
        ensurePool();
        String sql = "SELECT * FROM " + functionName + "($1::jsonb)";
        JsonArray arg = new JsonArray().add(new JsonObject().put("message", debeziumPayload));
        return pool.preparedQuery(sql)
                .execute(Tuple.of(arg))
                .onItem()
                .transform(rows -> {
                    if (!rows.iterator().hasNext()) {
                        throw new IllegalStateException("No result from function: " + functionName);
                    }
                    Row row = rows.iterator().next();
                    Object value = row.getValue(0);
                    if (value instanceof JsonObject json) {
                        return json;
                    }
                    return new JsonObject(value.toString());
                });
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
                    .setPassword(password.orElse(""));
            pool = PgBuilder.pool()
                    .with(new PoolOptions().setMaxSize(maxSize))
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
        String host = "localhost";
        int port = 5432;
        String database = "prod_iot_gps";
        int slash = normalized.indexOf('/');
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
            port = Integer.parseInt(hostPort.substring(colon + 1));
        } else if (!hostPort.isBlank()) {
            host = hostPort;
        }
        return new ParsedUrl(host, port, database);
    }

    @PreDestroy
    void close() {
        if (pool != null) {
            try {
                pool.close().await().indefinitely();
            } catch (Exception e) {
                LOG.warn("Error closing symptoms GPS pool", e);
            }
        }
    }

    record ParsedUrl(String host, int port, String database) {}
}

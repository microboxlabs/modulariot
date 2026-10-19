package com.microboxlabs.miot.symptoms.process;

import com.microboxlabs.miot.core.gps.GpsDatabase;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.regex.Pattern;
import org.jboss.logging.Logger;

/** Calls {@code process_symptoms_*} in StreamHub GPS Postgres ({@code prod_iot_gps}) through {@link GpsDatabase}. */
@ApplicationScoped
public class StreamhubSymptomsGpsClient implements FunctionInvoker {

    private static final Logger LOG = Logger.getLogger(StreamhubSymptomsGpsClient.class);
    private static final Pattern FUNCTION_NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

    private final GpsDatabase gps;

    StreamhubSymptomsGpsClient(GpsDatabase gps) {
        this.gps = gps;
    }

    public boolean isConfigured() {
        return gps.configured();
    }

    @Override
    public Uni<JsonObject> invoke(String functionName, JsonObject debeziumPayload) {
        if (!FUNCTION_NAME.matcher(functionName).matches()) {
            return Uni.createFrom()
                    .failure(new IllegalArgumentException("illegal function name: " + functionName));
        }
        if (!isConfigured()) {
            return Uni.createFrom().failure(new IllegalStateException(
                    "Symptoms GPS datasource is not configured (set MIOT_GPS_REACTIVE_URL / MIOT_GPS_USERNAME)"));
        }
        String sql = "SELECT * FROM " + functionName + "($1::jsonb)";
        JsonArray arg = new JsonArray().add(new JsonObject().put("message", debeziumPayload));
        return execute(sql, arg)
                .onFailure(this::isLostConnection)
                .recoverWithUni(err -> {
                    LOG.warnf(err, "GPS connection lost, retrying %s", functionName);
                    return execute(sql, arg);
                });
    }

    private Uni<JsonObject> execute(String sql, JsonArray arg) {
        return gps.pool().preparedQuery(sql)
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
}

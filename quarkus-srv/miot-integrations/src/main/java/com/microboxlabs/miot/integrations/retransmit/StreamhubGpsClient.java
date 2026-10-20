package com.microboxlabs.miot.integrations.retransmit;

import com.microboxlabs.miot.core.gps.GpsDatabase;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Client to StreamHub GPS Postgres ({@code prod_iot_gps}) for retransmit SQL
 * ({@code process_enriched_position_retransmit}), through {@link GpsDatabase}. Usable only when the worker is
 * enabled and the GPS database is configured.
 */
@ApplicationScoped
public class StreamhubGpsClient {

    private static final String PROCESS_SQL =
            "SELECT public.process_enriched_position_retransmit($1::jsonb) AS result";

    private final boolean workerEnabled;
    private final GpsDatabase gps;

    StreamhubGpsClient(
            @ConfigProperty(name = "miot.integrations.retransmit.worker.enabled", defaultValue = "false")
                    boolean workerEnabled,
            GpsDatabase gps) {
        this.workerEnabled = workerEnabled;
        this.gps = gps;
    }

    public boolean isConfigured() {
        return workerEnabled && gps.configured();
    }

    public JsonObject processEnrichedPosition(JsonObject enriched) {
        if (!isConfigured()) {
            throw new IllegalStateException(
                    "Retransmit GPS datasource is not configured (set MIOT_GPS_REACTIVE_URL / MIOT_GPS_USERNAME)");
        }
        var row = gps.pool().preparedQuery(PROCESS_SQL)
                .execute(Tuple.of(enriched))
                .await().indefinitely()
                .iterator()
                .next();
        JsonObject result = row.getJsonObject("result");
        return result == null ? new JsonObject() : result;
    }
}

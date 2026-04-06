package com.microboxlabs.miot.fleet.metrics;

import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.jboss.logging.Logger;

/**
 * Reads the latest OBD2/telemetry metric snapshot per asset from the metrics database.
 *
 * <p>Backed by {@code fn_latest_metrics} and {@code fn_latest_metrics_batch} PostgreSQL functions,
 * which use {@code DISTINCT ON} against the partitioned {@code asset_metric_core} table.
 *
 * <p>Returns JSONB — callers read any metric by key name:
 * <pre>
 *   JsonObject m = repo.getLatestMetrics(clientId, assetId).await().indefinitely();
 *   Integer fuelPct = m.getInteger("fuel_level_pct");   // null if not reported
 *   Long    odometer = m.getLong("odometer_km");
 * </pre>
 *
 * <p>Escalation path: if p95 latency exceeds 100ms (single) or 500ms (batch of 50),
 * swap the PostgreSQL function bodies for a {@code last_metric_data} table lookup —
 * this class requires no changes.
 */
@ApplicationScoped
public class LatestMetricsRepository {

    private static final Logger logger = Logger.getLogger(LatestMetricsRepository.class);

    private static final String SQL_SINGLE =
            "SELECT miot_tracking.fn_latest_metrics($1, $2)";

    private static final String SQL_BATCH =
            "SELECT asset_id, metrics FROM miot_tracking.fn_latest_metrics_batch($1, $2)";

    private final Instance<Pool> metricsClientInstance;

    LatestMetricsRepository(Instance<Pool> metricsClientInstance) {
        this.metricsClientInstance = metricsClientInstance;
    }

    private Pool metricsClient() {
        return metricsClientInstance.get();
    }

    /**
     * Returns the latest metric snapshot for one asset.
     * Returns an empty JsonObject if the asset has no recorded metrics.
     *
     * @param sharedClientId the tracking system client identifier
     * @param assetId        the GPS/OBD2 asset identifier (maps to asset_metric_core.asset_id)
     */
    public Uni<JsonObject> getLatestMetrics(String sharedClientId, String assetId) {
        long start = System.currentTimeMillis();
        return metricsClient().preparedQuery(SQL_SINGLE)
                .execute(Tuple.of(sharedClientId, assetId))
                .map(rows -> {
                    logger.infof("LATEST_METRICS_QUERY: %d ms - assetId: %s",
                            System.currentTimeMillis() - start, assetId);
                    var iter = rows.iterator();
                    if (!iter.hasNext()) return new JsonObject();
                    var value = iter.next().getValue(0);
                    if (value == null) return new JsonObject();
                    return value instanceof JsonObject jo ? jo : new JsonObject(value.toString());
                })
                .onFailure().invoke(e ->
                        logger.warnf("Failed to fetch latest metrics for assetId=%s: %s",
                                assetId, e.getMessage()));
    }

    /**
     * Returns the latest metric snapshot for multiple assets in one DB round-trip.
     * Assets with no recorded metrics are absent from the result map.
     *
     * @param sharedClientId the tracking system client identifier
     * @param assetIds       list of GPS/OBD2 asset identifiers
     * @return map of assetId → metrics JSONB
     */
    public Uni<Map<String, JsonObject>> getLatestMetricsBatch(
            String sharedClientId, List<String> assetIds) {
        if (assetIds == null || assetIds.isEmpty()) {
            return Uni.createFrom().item(Map.of());
        }
        long start = System.currentTimeMillis();
        return metricsClient().preparedQuery(SQL_BATCH)
                .execute(Tuple.of(sharedClientId, assetIds.toArray(new String[0])))
                .map(rows -> {
                    logger.infof("LATEST_METRICS_BATCH_QUERY: %d ms - %d assets",
                            System.currentTimeMillis() - start, assetIds.size());
                    Map<String, JsonObject> result = new HashMap<>();
                    rows.forEach(row -> {
                        String id = row.getString("asset_id");
                        var raw = row.getValue("metrics");
                        if (id != null && raw != null) {
                            result.put(id, raw instanceof JsonObject jo
                                    ? jo : new JsonObject(raw.toString()));
                        }
                    });
                    return result;
                })
                .onFailure().invoke(e ->
                        logger.warnf("Failed to fetch batch metrics for %d assets: %s",
                                assetIds.size(), e.getMessage()));
    }
}

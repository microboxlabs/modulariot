package com.microboxlabs.miot.fleet.metrics;

import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.jboss.logging.Logger;

@ApplicationScoped
public class LatestFleetSnapshotRepository {

    private static final Logger LOG = Logger.getLogger(LatestFleetSnapshotRepository.class);

    private static final String SQL_BATCH = """
            SELECT asset_id, tracking, metric_core, metric_dtc, metric_ext
            FROM miot_tracking.fn_latest_fleet_snapshot_batch($1, $2)
            """;

    private final Instance<Pool> clientInstance;

    LatestFleetSnapshotRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    private Pool client() {
        return clientInstance.get();
    }

    public Uni<Map<String, SnapshotBundle>> getLatestFleetSnapshotBatch(
            String sharedClientId, List<String> assetIds) {
        if (assetIds == null || assetIds.isEmpty()) {
            return Uni.createFrom().item(Map.of());
        }

        long start = System.currentTimeMillis();
        return client().preparedQuery(SQL_BATCH)
                .execute(Tuple.of(sharedClientId, assetIds.toArray(new String[0])))
                .map(rows -> {
                    LOG.infof("LATEST_FLEET_SNAPSHOT_BATCH_QUERY: %d ms - %d assets",
                            System.currentTimeMillis() - start, assetIds.size());
                    Map<String, SnapshotBundle> result = new HashMap<>();
                    rows.forEach(row -> result.put(row.getString("asset_id"), toBundle(row)));
                    return result;
                })
                .onFailure().invoke(e ->
                        LOG.warnf("Failed to fetch fleet snapshot batch for %d assets: %s",
                                assetIds.size(), e.getMessage()));
    }

    private SnapshotBundle toBundle(Row row) {
        return new SnapshotBundle(
                toJsonObject(row.getValue("tracking")),
                toJsonObject(row.getValue("metric_core")),
                toJsonObject(row.getValue("metric_dtc")),
                toJsonObject(row.getValue("metric_ext")));
    }

    private JsonObject toJsonObject(Object raw) {
        if (raw == null) {
            return null;
        }
        return raw instanceof JsonObject json ? json : new JsonObject(raw.toString());
    }

    public record SnapshotBundle(
            JsonObject tracking,
            JsonObject metricCore,
            JsonObject metricDtc,
            JsonObject metricExt) {
    }
}

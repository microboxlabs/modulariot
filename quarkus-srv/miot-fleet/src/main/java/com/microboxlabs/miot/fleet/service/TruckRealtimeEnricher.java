package com.microboxlabs.miot.fleet.service;

import com.microboxlabs.miot.fleet.metrics.LatestFleetSnapshotRepository;
import com.microboxlabs.miot.fleet.metrics.LatestFleetSnapshotRepository.SnapshotBundle;
import com.microboxlabs.miot.fleet.model.Truck;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jboss.logging.Logger;

@ApplicationScoped
public class TruckRealtimeEnricher {

    private static final Logger LOG = Logger.getLogger(TruckRealtimeEnricher.class);

    private final LatestFleetSnapshotRepository latestFleetSnapshotRepository;
    private final TruckMetricCatalog truckMetricCatalog;

    TruckRealtimeEnricher(
            LatestFleetSnapshotRepository latestFleetSnapshotRepository,
            TruckMetricCatalog truckMetricCatalog) {
        this.latestFleetSnapshotRepository = latestFleetSnapshotRepository;
        this.truckMetricCatalog = truckMetricCatalog;
    }

    public Uni<List<Truck>> enrichList(String sharedClientId, List<Truck> trucks, TruckMetricSelection selection) {
        if (trucks == null || trucks.isEmpty()) {
            return Uni.createFrom().item(trucks);
        }
        if (selection == null || selection.isDisabled()) {
            trucks.forEach(truck -> truck.latestMetrics = null);
            return Uni.createFrom().item(trucks);
        }

        List<String> assetIds = trucks.stream()
                .map(truck -> truck.assetId)
                .filter(Objects::nonNull)
                .filter(assetId -> !assetId.isBlank())
                .collect(java.util.stream.Collectors.collectingAndThen(
                        java.util.stream.Collectors.toCollection(LinkedHashSet::new),
                        List::copyOf));

        if (assetIds.isEmpty()) {
            return Uni.createFrom().item(trucks);
        }

        LOG.infof("TRUCK_METRICS_ENRICH_LIST: %d assets - view=%s fields=%s",
                assetIds.size(), selection.metricView(), selection.metricFields());
        return latestFleetSnapshotRepository.getLatestFleetSnapshotBatch(sharedClientId, assetIds)
                .map(snapshots -> {
                    trucks.forEach(truck -> applySnapshot(truck, snapshots.get(truck.assetId), selection));
                    return trucks;
                })
                .onFailure().recoverWithItem(trucks);
    }

    public Uni<Truck> enrichTruck(String sharedClientId, Truck truck, TruckMetricSelection selection) {
        if (selection == null || selection.isDisabled()) {
            if (truck != null) {
                truck.latestMetrics = null;
            }
            return Uni.createFrom().item(truck);
        }
        if (truck == null || truck.assetId == null || truck.assetId.isBlank()) {
            return Uni.createFrom().item(truck);
        }

        LOG.infof("TRUCK_METRICS_ENRICH_DETAIL: assetId=%s - view=%s fields=%s",
                truck.assetId, selection.metricView(), selection.metricFields());
        return latestFleetSnapshotRepository
                .getLatestFleetSnapshotBatch(sharedClientId, List.of(truck.assetId))
                .map(snapshots -> {
                    applySnapshot(truck, snapshots.get(truck.assetId), selection);
                    return truck;
                })
                .onFailure().recoverWithItem(truck);
    }

    private void applySnapshot(Truck truck, SnapshotBundle snapshot, TruckMetricSelection selection) {
        if (truck == null || snapshot == null) {
            return;
        }
        JsonObject latestMetrics = new JsonObject();
        JsonObject core = snapshot.metricCore();
        for (String field : selection.metricFields()) {
            Object value = switch (truckMetricCatalog.sourceOf(field)) {
                case CORE -> core != null ? core.getValue(field) : null;
                case CORE_TIMESTAMP -> resolveTimestamp(snapshot);
            };
            if (value != null) {
                latestMetrics.put(field, value);
            }
        }
        truck.latestMetrics = latestMetrics.isEmpty() ? null : latestMetrics;
    }

    private Object resolveTimestamp(SnapshotBundle snapshot) {
        JsonObject core = snapshot.metricCore();
        if (core != null && core.getValue("ts") != null) {
            return core.getValue("ts");
        }
        JsonObject tracking = snapshot.tracking();
        return tracking != null ? tracking.getValue("timestamp") : null;
    }
}

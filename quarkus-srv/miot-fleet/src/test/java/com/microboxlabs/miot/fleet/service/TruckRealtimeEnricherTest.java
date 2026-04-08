package com.microboxlabs.miot.fleet.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.fleet.metrics.LatestFleetSnapshotRepository.SnapshotBundle;
import com.microboxlabs.miot.fleet.model.Truck;
import io.vertx.core.json.JsonObject;
import java.util.List;
import org.junit.jupiter.api.Test;

class TruckRealtimeEnricherTest {

    private final TruckMetricCatalog catalog = new TruckMetricCatalog();
    private final TruckRealtimeEnricher enricher = new TruckRealtimeEnricher(null, catalog);

    @Test
    void applySnapshotPopulatesTrackingFieldsFromTrackingJson() {
        Truck truck = new Truck();
        truck.assetId = "asset-1";

        JsonObject tracking = new JsonObject()
                .put("timestamp", "2026-04-08T12:00:00Z")
                .put("latitude", -33.4489)
                .put("longitude", -70.6693)
                .put("heading", 275.5);
        SnapshotBundle snapshot = new SnapshotBundle(tracking, null, null, null);

        TruckMetricSelection selection = new TruckMetricSelection(
                true, null, List.of("timestamp", "latitude", "longitude", "heading"));

        enricher.applySnapshot(truck, snapshot, selection);

        JsonObject metrics = truck.latestMetrics;
        assertEquals("2026-04-08T12:00:00Z", metrics.getValue("timestamp"));
        assertEquals(-33.4489, metrics.getDouble("latitude"));
        assertEquals(-70.6693, metrics.getDouble("longitude"));
        assertEquals(275.5, metrics.getDouble("heading"));
    }

    @Test
    void applySnapshotMergesTrackingAndCoreFields() {
        Truck truck = new Truck();
        truck.assetId = "asset-2";

        JsonObject tracking = new JsonObject()
                .put("latitude", 10.0)
                .put("longitude", 20.0)
                .put("heading", 90.0);
        JsonObject core = new JsonObject()
                .put("ts", "2026-04-08T12:05:00Z")
                .put("vehicle_speed_kph", 65)
                .put("fuel_level_pct", 78);
        SnapshotBundle snapshot = new SnapshotBundle(tracking, core, null, null);

        TruckMetricSelection selection = new TruckMetricSelection(
                true, "card", List.of(
                        "timestamp", "fuel_level_pct", "vehicle_speed_kph",
                        "latitude", "longitude", "heading"));

        enricher.applySnapshot(truck, snapshot, selection);

        JsonObject metrics = truck.latestMetrics;
        assertEquals("2026-04-08T12:05:00Z", metrics.getValue("timestamp"));
        assertEquals(65, metrics.getInteger("vehicle_speed_kph"));
        assertEquals(78, metrics.getInteger("fuel_level_pct"));
        assertEquals(10.0, metrics.getDouble("latitude"));
        assertEquals(20.0, metrics.getDouble("longitude"));
        assertEquals(90.0, metrics.getDouble("heading"));
    }

    @Test
    void applySnapshotSkipsMissingTrackingValues() {
        Truck truck = new Truck();
        truck.assetId = "asset-3";

        JsonObject tracking = new JsonObject().put("latitude", 1.23);
        SnapshotBundle snapshot = new SnapshotBundle(tracking, null, null, null);

        TruckMetricSelection selection = new TruckMetricSelection(
                true, null, List.of("latitude", "longitude", "heading"));

        enricher.applySnapshot(truck, snapshot, selection);

        JsonObject metrics = truck.latestMetrics;
        assertEquals(1.23, metrics.getDouble("latitude"));
        assertFalse(metrics.containsKey("longitude"));
        assertFalse(metrics.containsKey("heading"));
    }

    @Test
    void applySnapshotNullsLatestMetricsWhenTrackingIsNull() {
        Truck truck = new Truck();
        truck.assetId = "asset-4";

        SnapshotBundle snapshot = new SnapshotBundle(null, null, null, null);
        TruckMetricSelection selection = new TruckMetricSelection(
                true, null, List.of("latitude", "longitude"));

        enricher.applySnapshot(truck, snapshot, selection);

        assertNull(truck.latestMetrics);
    }

    @Test
    void applySnapshotNullsLatestMetricsWhenSnapshotIsNull() {
        Truck truck = new Truck();
        truck.assetId = "asset-5";
        truck.latestMetrics = new JsonObject().put("stale", true);

        TruckMetricSelection selection = new TruckMetricSelection(
                true, null, List.of("latitude"));

        enricher.applySnapshot(truck, null, selection);

        assertNull(truck.latestMetrics);
    }

    @Test
    void cardPresetIncludesLocationFields() {
        TruckMetricSelection selection = catalog.resolve(true, "card", null);
        assertTrue(selection.metricFields().contains("latitude"));
        assertTrue(selection.metricFields().contains("longitude"));
        assertTrue(selection.metricFields().contains("heading"));
    }

    @Test
    void detailPresetIncludesLocationFields() {
        TruckMetricSelection selection = catalog.resolve(true, "detail", null);
        assertTrue(selection.metricFields().contains("latitude"));
        assertTrue(selection.metricFields().contains("longitude"));
        assertTrue(selection.metricFields().contains("heading"));
    }
}

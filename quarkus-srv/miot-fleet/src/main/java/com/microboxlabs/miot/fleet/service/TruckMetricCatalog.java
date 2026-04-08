package com.microboxlabs.miot.fleet.service;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class TruckMetricCatalog {

    private static final int MAX_METRIC_FIELDS = 16;
    private static final String DEFAULT_VIEW = "card";
    private static final String TIMESTAMP = "timestamp";
    private static final String FUEL_LEVEL_PCT = "fuel_level_pct";
    private static final String FUEL_VOLUME_ML = "fuel_volume_ml";
    private static final String ODOMETER_KM = "odometer_km";
    private static final String BATTERY_VOLTAGE_MV = "battery_voltage_mv";
    private static final String VEHICLE_SPEED_KPH = "vehicle_speed_kph";
    private static final String LATITUDE = "latitude";
    private static final String LONGITUDE = "longitude";
    private static final String HEADING = "heading";

    private final Map<String, MetricSource> supportedFields;
    private final Map<String, List<String>> presetViews;

    public TruckMetricCatalog() {
        Map<String, MetricSource> fields = new LinkedHashMap<>();
        fields.put(TIMESTAMP, MetricSource.CORE_TIMESTAMP);
        fields.put(FUEL_LEVEL_PCT, MetricSource.CORE);
        fields.put(FUEL_VOLUME_ML, MetricSource.CORE);
        fields.put(ODOMETER_KM, MetricSource.CORE);
        fields.put(BATTERY_VOLTAGE_MV, MetricSource.CORE);
        fields.put(VEHICLE_SPEED_KPH, MetricSource.CORE);
        fields.put("engine_rpm", MetricSource.CORE);
        fields.put("engine_load_pct", MetricSource.CORE);
        fields.put("coolant_temp_c", MetricSource.CORE);
        fields.put("idle_state", MetricSource.CORE);
        fields.put("mil_on", MetricSource.CORE);
        fields.put("dtc_count", MetricSource.CORE);
        fields.put(LATITUDE, MetricSource.TRACKING);
        fields.put(LONGITUDE, MetricSource.TRACKING);
        fields.put(HEADING, MetricSource.TRACKING);
        this.supportedFields = Map.copyOf(fields);

        Map<String, List<String>> views = new LinkedHashMap<>();
        views.put("card", List.of(TIMESTAMP, FUEL_LEVEL_PCT, ODOMETER_KM, BATTERY_VOLTAGE_MV,
                VEHICLE_SPEED_KPH, LATITUDE, LONGITUDE, HEADING));
        views.put("detail", List.of(TIMESTAMP, FUEL_LEVEL_PCT, ODOMETER_KM, BATTERY_VOLTAGE_MV,
                VEHICLE_SPEED_KPH, "engine_rpm", "engine_load_pct", "coolant_temp_c", "idle_state",
                LATITUDE, LONGITUDE, HEADING));
        views.put("diagnostics", List.of(TIMESTAMP, "mil_on", "dtc_count"));
        this.presetViews = Map.copyOf(views);
    }

    public TruckMetricSelection resolve(boolean includeMetrics, String metricView, String metricFields) {
        boolean hasMetricParams = hasText(metricView) || hasText(metricFields);
        if (!includeMetrics) {
            if (hasMetricParams) {
                throw new BadRequestException("metricView and metricFields require includeMetrics=true");
            }
            return TruckMetricSelection.NONE;
        }

        if (hasText(metricFields)) {
            return new TruckMetricSelection(true, null, parseMetricFields(metricFields));
        }

        String resolvedView = hasText(metricView) ? metricView.trim().toLowerCase(Locale.ROOT) : DEFAULT_VIEW;
        List<String> preset = presetViews.get(resolvedView);
        if (preset == null) {
            throw new BadRequestException("Unsupported metricView: " + metricView);
        }
        return new TruckMetricSelection(true, resolvedView, preset);
    }

    public MetricSource sourceOf(String field) {
        MetricSource source = supportedFields.get(field);
        if (source == null) {
            throw new BadRequestException("Unsupported metric field: " + field);
        }
        return source;
    }

    public Set<String> supportedFields() {
        return supportedFields.keySet();
    }

    private List<String> parseMetricFields(String metricFields) {
        String[] rawFields = metricFields.split(",");
        Set<String> deduped = new LinkedHashSet<>();
        List<String> unsupported = new ArrayList<>();

        for (String rawField : rawFields) {
            String field = rawField.trim().toLowerCase(Locale.ROOT);
            if (field.isEmpty()) {
                // Ignore empty entries from malformed comma-separated input.
            } else if (!supportedFields.containsKey(field)) {
                unsupported.add(field);
            } else {
                deduped.add(field);
            }
        }

        if (!unsupported.isEmpty()) {
            throw new BadRequestException("Unsupported metric fields: " + String.join(",", unsupported));
        }
        if (deduped.isEmpty()) {
            throw new BadRequestException("metricFields must include at least one supported field");
        }
        if (!deduped.contains(TIMESTAMP)) {
            deduped.add(TIMESTAMP);
        }
        if (deduped.size() > MAX_METRIC_FIELDS) {
            throw new BadRequestException("metricFields exceeds max allowed fields: " + MAX_METRIC_FIELDS);
        }
        return List.copyOf(deduped);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public enum MetricSource {
        CORE,
        CORE_TIMESTAMP,
        TRACKING
    }
}

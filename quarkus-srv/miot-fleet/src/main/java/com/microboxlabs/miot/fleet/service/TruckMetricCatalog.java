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

    private final Map<String, MetricSource> supportedFields;
    private final Map<String, List<String>> presetViews;

    public TruckMetricCatalog() {
        Map<String, MetricSource> fields = new LinkedHashMap<>();
        fields.put(TIMESTAMP, MetricSource.CORE_TIMESTAMP);
        fields.put("fuel_level_pct", MetricSource.CORE);
        fields.put("odometer_km", MetricSource.CORE);
        fields.put("battery_voltage_mv", MetricSource.CORE);
        fields.put("vehicle_speed_kph", MetricSource.CORE);
        fields.put("engine_rpm", MetricSource.CORE);
        fields.put("engine_load_pct", MetricSource.CORE);
        fields.put("coolant_temp_c", MetricSource.CORE);
        fields.put("idle_state", MetricSource.CORE);
        fields.put("mil_on", MetricSource.CORE);
        fields.put("dtc_count", MetricSource.CORE);
        this.supportedFields = Map.copyOf(fields);

        Map<String, List<String>> views = new LinkedHashMap<>();
        views.put("card", List.of(TIMESTAMP, "fuel_level_pct", "odometer_km", "battery_voltage_mv", "vehicle_speed_kph"));
        views.put("detail", List.of(TIMESTAMP, "fuel_level_pct", "odometer_km", "battery_voltage_mv",
                "vehicle_speed_kph", "engine_rpm", "engine_load_pct", "coolant_temp_c", "idle_state"));
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
                continue;
            }
            if (!supportedFields.containsKey(field)) {
                unsupported.add(field);
                continue;
            }
            deduped.add(field);
        }

        if (!unsupported.isEmpty()) {
            throw new BadRequestException("Unsupported metric fields: " + String.join(",", unsupported));
        }
        if (deduped.isEmpty()) {
            throw new BadRequestException("metricFields must include at least one supported field");
        }
        if (deduped.size() > MAX_METRIC_FIELDS) {
            throw new BadRequestException("metricFields exceeds max allowed fields: " + MAX_METRIC_FIELDS);
        }
        if (!deduped.contains(TIMESTAMP)) {
            deduped.add(TIMESTAMP);
        }
        return List.copyOf(deduped);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public enum MetricSource {
        CORE,
        CORE_TIMESTAMP
    }
}

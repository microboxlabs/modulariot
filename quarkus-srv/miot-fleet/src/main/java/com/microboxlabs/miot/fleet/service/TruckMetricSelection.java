package com.microboxlabs.miot.fleet.service;

import java.util.List;

public record TruckMetricSelection(
        boolean includeMetrics,
        String metricView,
        List<String> metricFields) {

    public static final TruckMetricSelection NONE =
            new TruckMetricSelection(false, null, List.of());

    public boolean isDisabled() {
        return !includeMetrics || metricFields == null || metricFields.isEmpty();
    }
}

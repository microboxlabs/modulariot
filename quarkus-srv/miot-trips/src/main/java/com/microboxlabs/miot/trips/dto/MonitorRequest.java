package com.microboxlabs.miot.trips.dto;

import com.microboxlabs.miot.trips.domain.MonitorScope;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import java.util.List;
import java.util.Map;

/**
 * A monitor's draft; see {@link TripMonitor}. A rule without {@code priority} gets 100; without {@code active}, on.
 * Without {@code scope} the monitor takes no trips and cannot be published.
 */
public record MonitorRequest(
        String name,
        String description,
        List<TripMonitor.StagePlan> plan,
        Map<String, Object> params,
        List<Rule> rules,
        MonitorScope scope) {

    public record Rule(String key, String name, String on, String at, String when, List<TripMonitor.Action> then,
            Integer priority, Boolean active) {
    }
}

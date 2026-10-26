package com.microboxlabs.miot.trips.monitor;

import com.microboxlabs.miot.trips.domain.DeliveryCycle;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * What a monitor's expressions may read for one trigger: field paths and their types. Types are {@code text},
 * {@code number}, {@code bool}, {@code time} and {@code any}. A segment ending in {@code []} is a list of objects
 * ({@code mandates[].status}); {@link #DYNAMIC} roots are read without a type check ({@code plan}).
 *
 * @param fields full path to type, in display order
 */
public record MonitorSchema(Map<String, String> fields) {

    public static final String TEXT = "text";
    public static final String NUMBER = "number";
    public static final String BOOL = "bool";
    public static final String TIME = "time";
    /** Read without a type check: what a source sent ({@code milestones.validation.evidence}). */
    public static final String ANY = "any";

    /** Roots whose content each source decides. */
    public static final List<String> DYNAMIC = List.of("plan");

    public static final List<String> TRIGGERS = List.of("plan", "signal", "timer", "stage", "command");
    public static final List<String> STAGE_TYPES =
            List.of("preparation", "loading", "transit", "stop", "unloading", "closing");
    public static final List<String> RESOURCES = List.of("truck", "trailer", "driver");
    public static final List<String> MILESTONES = TripMilestone.MILESTONES;

    public MonitorSchema {
        fields = java.util.Collections.unmodifiableMap(new LinkedHashMap<>(fields));
    }

    /** The context of an expression evaluated on {@code trigger}, with the monitor's parameters. */
    public static MonitorSchema of(String trigger, Map<String, Object> params) {
        Map<String, String> f = new LinkedHashMap<>();
        f.put("trip.id", TEXT);
        f.put("trip.status", TEXT);
        f.put("trip.orderType", TEXT);
        times(f, "trip");
        location(f, "trip.origin");
        location(f, "trip.destination");
        stage(f, "stage");
        for (String type : STAGE_TYPES) {
            stage(f, "stages." + type);
        }
        f.put("mandates[].externalCode", TEXT);
        f.put("mandates[].status", TEXT);
        f.put("mandates[].orderType", TEXT);
        f.put("mandates[].orderRef", TEXT);
        for (String r : RESOURCES) {
            f.put("assignments." + r + ".key", TEXT);
            f.put("assignments." + r + ".since", TIME);
        }
        if ("signal".equals(trigger)) {
            f.put("signal.kind", TEXT);
            f.put("signal.geofenceId", TEXT);
            f.put("signal.at", TIME);
        }
        f.put("event.on", TEXT);
        f.put("event.kind", TEXT);
        f.put("event.stageType", TEXT);
        f.put("event.at", TIME);
        f.put("event.actor", TEXT);
        f.put("event.milestone", TEXT);
        f.put("event.channel", TEXT);
        for (String m : MILESTONES) {
            String root = "milestones." + m;
            f.put(root + ".status", TEXT);
            f.put(root + ".source", TEXT);
            f.put(root + ".channel", TEXT);
            f.put(root + ".proposedAt", TIME);
            f.put(root + ".confirmedAt", TIME);
            f.put(root + ".evidence", ANY);
        }
        for (String step : DeliveryCycle.ALL_STEPS) {
            f.put("deliveries." + step, BOOL);
        }
        if (params != null) {
            params.forEach((name, value) -> f.put("params." + name, switch (value) {
                case Number n -> NUMBER;
                case Boolean b -> BOOL;
                case null, default -> TEXT;
            }));
        }
        return new MonitorSchema(f);
    }

    /** The context of a selector condition: the trip being created, before it has stages or a monitor. */
    public static MonitorSchema selector() {
        Map<String, String> f = new LinkedHashMap<>();
        f.put("trip.orderType", TEXT);
        f.put("trip.plannedStart", TIME);
        location(f, "trip.origin");
        location(f, "trip.destination");
        f.put("mandates[].externalCode", TEXT);
        f.put("mandates[].orderType", TEXT);
        f.put("mandates[].orderRef", TEXT);
        return new MonitorSchema(f);
    }

    private static void stage(Map<String, String> f, String root) {
        f.put(root + ".type", TEXT);
        f.put(root + ".status", TEXT);
        f.put(root + ".serviceStatus", TEXT);
        times(f, root);
        location(f, root + ".location");
    }

    private static void times(Map<String, String> f, String root) {
        f.put(root + ".plannedStart", TIME);
        f.put(root + ".plannedEnd", TIME);
        f.put(root + ".actualStart", TIME);
        f.put(root + ".actualEnd", TIME);
    }

    private static void location(Map<String, String> f, String root) {
        f.put(root + ".code", TEXT);
        f.put(root + ".name", TEXT);
        f.put(root + ".type", TEXT);
        f.put(root + ".geofenceId", TEXT);
    }
}

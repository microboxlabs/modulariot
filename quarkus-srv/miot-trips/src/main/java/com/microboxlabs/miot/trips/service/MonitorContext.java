package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.MonitorRun;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import com.microboxlabs.miot.trips.store.AssignmentStore;
import com.microboxlabs.miot.trips.store.LocationStore;
import com.microboxlabs.miot.trips.store.StageStore;
import com.microboxlabs.miot.trips.store.TripStore;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Builds what a monitor's expressions read (see {@code MonitorSchema}) from the stored trip. A value the trip does
 * not have yet is left out, so rules test it with {@code has()}. Times are {@link java.time.Instant}s.
 */
final class MonitorContext {
    private static final String GEOFENCE_ID = "geofenceId";

    private static final String STATUS = "status";
    private static final String CHANNEL = "channel";

    private static final String PLANNED_START = "plannedStart";

    private static final String ORDER_TYPE = "orderType";

    private final TripStore trips;
    private final StageStore stages;
    private final AssignmentStore assignments;
    private final LocationStore locations;
    private final MandateService mandates;
    private final MilestoneService milestones;
    private final FleetResources fleet;

    MonitorContext(TripStore trips, StageStore stages, AssignmentStore assignments, LocationStore locations,
            MandateService mandates, MilestoneService milestones, FleetResources fleet) {
        this.trips = trips;
        this.stages = stages;
        this.assignments = assignments;
        this.locations = locations;
        this.mandates = mandates;
        this.milestones = milestones;
        this.fleet = fleet;
    }

    /** The context of {@code event} on the trip, with the monitor's parameters. */
    Map<String, Object> of(Trip trip, MonitorRun.Event event, Map<String, Object> params) {
        String tenant = trip.tenantCode();
        UUID tripId = UUID.fromString(trip.id());
        Map<String, Map<String, Object>> places = new HashMap<>();
        List<Stage> plan = stages.listBySubject(tenant, Stage.SUBJECT_TRIP, tripId);
        List<Map<String, Object>> linked = mandates(tenant, tripId);

        Map<String, Object> ctx = new LinkedHashMap<>();
        Map<String, Object> t = trip(trip, plan, linked, places);
        ctx.put("trip", t);
        ctx.put("stage", plan.stream().filter(s -> Stage.RUNNING.equals(s.status())).findFirst()
                .map(s -> stage(tenant, s, places)).orElse(Map.of()));
        Map<String, Object> byType = new LinkedHashMap<>();
        plan.stream().sorted(Comparator.comparingInt(Stage::seq))
                .forEach(s -> byType.putIfAbsent(s.stageType(), stage(tenant, s, places)));
        ctx.put("stages", byType);
        ctx.put("mandates", linked);
        ctx.put("assignments", assignments(tenant, tripId));
        ctx.put("milestones", milestones(tenant, tripId));
        ctx.put("event", event(event));
        if ("signal".equals(event.on())) {
            Map<String, Object> signal = new LinkedHashMap<>();
            putIf(signal, "kind", event.kind());
            putIf(signal, GEOFENCE_ID, event.data().get(GEOFENCE_ID));
            putIf(signal, "at", instant(event.at()));
            ctx.put("signal", signal);
        }
        ctx.put("params", params == null ? Map.of() : params);
        ctx.put("plan", Map.of());
        return ctx;
    }

    /** What a selector condition reads: the trip just created. */
    Map<String, Object> ofNewTrip(Trip trip) {
        String tenant = trip.tenantCode();
        UUID tripId = UUID.fromString(trip.id());
        Map<String, Map<String, Object>> places = new HashMap<>();
        List<Map<String, Object>> linked = mandates(tenant, tripId);
        Map<String, Object> t = new LinkedHashMap<>();
        putIf(t, ORDER_TYPE, linked.isEmpty() ? null : linked.get(0).get(ORDER_TYPE));
        putIf(t, PLANNED_START, instant(trip.plannedStart()));
        location(tenant, trip.originId(), places).ifPresent(value -> t.put("origin", value));
        location(tenant, trip.destinationId(), places).ifPresent(value -> t.put("destination", value));
        return Map.of("trip", t, "mandates", linked);
    }

    static Map<String, Object> event(MonitorRun.Event event) {
        Map<String, Object> e = new LinkedHashMap<>();
        putIf(e, "on", event.on());
        putIf(e, "kind", event.kind());
        putIf(e, "stageType", event.data().get("stageType"));
        putIf(e, "milestone", event.data().get("milestone"));
        putIf(e, CHANNEL, event.data().get(CHANNEL));
        putIf(e, "at", instant(event.at()));
        putIf(e, "actor", event.actor());
        return e;
    }

    private Map<String, Object> trip(Trip trip, List<Stage> plan, List<Map<String, Object>> linked,
            Map<String, Map<String, Object>> places) {
        String tenant = trip.tenantCode();
        Map<String, Object> t = new LinkedHashMap<>();
        putIf(t, "id", trip.id());
        putIf(t, STATUS, trip.status());
        putIf(t, ORDER_TYPE, linked.isEmpty() ? null : linked.get(0).get(ORDER_TYPE));
        putIf(t, PLANNED_START, instant(trip.plannedStart()));
        putIf(t, "plannedEnd", plan.stream().map(Stage::plannedEnd).filter(Objects::nonNull)
                .max(Comparator.naturalOrder()).map(MonitorContext::instant).orElse(null));
        putIf(t, "actualStart", instant(trip.actualStart()));
        putIf(t, "actualEnd", instant(trip.actualEnd()));
        location(tenant, trip.originId(), places).ifPresent(value -> t.put("origin", value));
        location(tenant, trip.destinationId(), places).ifPresent(value -> t.put("destination", value));
        return t;
    }

    private Map<String, Object> stage(String tenant, Stage s, Map<String, Map<String, Object>> places) {
        Map<String, Object> m = new LinkedHashMap<>();
        putIf(m, "type", s.stageType());
        putIf(m, STATUS, s.status());
        putIf(m, "serviceStatus", s.serviceStatus());
        putIf(m, PLANNED_START, instant(s.plannedStart()));
        putIf(m, "plannedEnd", instant(s.plannedEnd()));
        putIf(m, "actualStart", instant(s.actualStart()));
        putIf(m, "actualEnd", instant(s.actualEnd()));
        location(tenant, s.locationId(), places).ifPresent(value -> m.put("location", value));
        return m;
    }

    private Optional<Map<String, Object>> location(String tenant, String id, Map<String, Map<String, Object>> places) {
        if (id == null) {
            return Optional.empty();
        }
        return Optional.of(places.computeIfAbsent(id, k -> {
            Optional<Location> l = locations.find(tenant, UUID.fromString(k));
            Map<String, Object> m = new LinkedHashMap<>();
            l.ifPresent(loc -> {
                putIf(m, "code", loc.externalCode());
                putIf(m, "name", loc.name());
                putIf(m, "type", loc.type());
                putIf(m, GEOFENCE_ID, loc.geofenceId() == null ? null : loc.geofenceId().toString());
            });
            return m;
        }));
    }

    private List<Map<String, Object>> mandates(String tenant, UUID tripId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (MandateRef ref : trips.mandatesOf(tenant, tripId)) {
            Map<String, Object> m = new LinkedHashMap<>();
            putIf(m, "externalCode", ref.externalCode());
            putIf(m, STATUS, ref.status());
            try {
                Mandate mandate = mandates.get(tenant, UUID.fromString(ref.mandateId()));
                putIf(m, ORDER_TYPE, mandate.orderType());
                putIf(m, "orderRef", mandate.orderRef());
            } catch (RuntimeException e) {
                // a mandate that cannot be read keeps its code and status only
            }
            out.add(m);
        }
        return out;
    }

    /** Each milestone by name: its status ({@code open} when nothing is recorded), source and times. */
    private Map<String, Object> milestones(String tenant, UUID tripId) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (TripMilestone m : milestones.list(tenant, tripId)) {
            Map<String, Object> v = new LinkedHashMap<>();
            putIf(v, STATUS, m.status());
            putIf(v, "source", m.source());
            putIf(v, CHANNEL, m.channel());
            putIf(v, "proposedAt", instant(m.proposedAt()));
            putIf(v, "confirmedAt", instant(m.confirmedAt()));
            v.put("evidence", m.evidence());
            out.put(m.milestone(), v);
        }
        return out;
    }

    /** The resources assigned now, by type: plate or document, and since when. */
    private Map<String, Object> assignments(String tenant, UUID tripId) {
        Map<String, Object> out = new LinkedHashMap<>();
        assignments.listByTrip(tenant, tripId).stream()
                .filter(a -> a.validTo() == null || a.validTo().isAfter(OffsetDateTime.now(ZoneOffset.UTC)))
                .sorted(Comparator.comparing(Assignment::validFrom, Comparator.nullsFirst(Comparator.naturalOrder())))
                .forEach(a -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    putIf(m, "key", resourceKey(tenant, a));
                    putIf(m, "since", instant(a.validFrom()));
                    if (Assignment.DRIVER.equals(a.resourceType())) {
                        out.putIfAbsent(a.resourceType(), m);
                    } else {
                        out.put(a.resourceType(), m);
                    }
                });
        return out;
    }

    private String resourceKey(String tenant, Assignment a) {
        try {
            UUID id = UUID.fromString(a.resourceId());
            if (Assignment.DRIVER.equals(a.resourceType())) {
                return fleet.driver(tenant, id).map(FleetResources.Driver::rut).orElse(null);
            }
            return fleet.vehicle(tenant, a.resourceType(), id).map(FleetResources.Vehicle::licensePlate)
                    .orElse(null);
        } catch (RuntimeException e) {
            return null;
        }
    }

    static java.time.Instant instant(OffsetDateTime t) {
        return t == null ? null : t.toInstant();
    }

    private static void putIf(Map<String, Object> m, String key, Object value) {
        if (value != null) {
            m.put(key, value);
        }
    }
}

package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripLiveProjection;
import com.microboxlabs.miot.trips.store.AssignmentStore;
import com.microboxlabs.miot.trips.store.CargoStore;
import com.microboxlabs.miot.trips.store.LocationStore;
import com.microboxlabs.miot.trips.store.Pg;
import com.microboxlabs.miot.trips.store.StageStore;
import com.microboxlabs.miot.trips.store.TripLiveStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Rebuilds a trip's hot row ({@code trip_live}) from the trip record. Every service that changes what the row shows
 * calls it before its transaction commits. A realized or cancelled trip has no row.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class TripLiveProjector {

    private static final int TYPE_LOAD_MAX = 255;
    private static final int LABEL_MAX = 128;

    private final TripStore trips;
    private final StageStore stages;
    private final AssignmentStore assignments;
    private final CargoStore cargo;
    private final LocationStore locations;
    private final TripLiveStore live;
    private final FleetResources fleet;

    @Inject
    public TripLiveProjector(TripStore trips, StageStore stages, AssignmentStore assignments, CargoStore cargo,
            LocationStore locations, TripLiveStore live, FleetResources fleet) {
        this.trips = trips;
        this.stages = stages;
        this.assignments = assignments;
        this.cargo = cargo;
        this.locations = locations;
        this.live = live;
        this.fleet = fleet;
    }

    /** Reading the trip takes its row lock, as every trip operation does first, so rebuilds of one trip queue up. */
    public void refresh(String tenantCode, UUID tripId) {
        Optional<Trip> found = trips.find(tenantCode, tripId);
        if (found.isEmpty() || Trip.DONE.equals(found.get().status())
                || Trip.CANCELLED.equals(found.get().status())) {
            live.delete(tenantCode, tripId);
            return;
        }
        Trip t = found.get();
        List<Assignment> open = assignments.listByTrip(tenantCode, tripId).stream()
                .filter(a -> a.validTo() == null).toList();
        Optional<FleetResources.Vehicle> truck = latestVehicle(tenantCode, open, Assignment.TRUCK);
        Optional<FleetResources.Vehicle> trailer = latestVehicle(tenantCode, open, Assignment.TRAILER);
        // the first two open driver windows, in the order they opened
        List<FleetResources.Driver> drivers = open.stream()
                .filter(a -> Assignment.DRIVER.equals(a.resourceType()))
                .map(a -> fleet.driver(tenantCode, UUID.fromString(a.resourceId())))
                .flatMap(Optional::stream).limit(2).toList();
        Optional<FleetResources.Carrier> carrier = truck.map(FleetResources.Vehicle::carrierId)
                .flatMap(id -> fleet.carrier(tenantCode, id));
        FleetResources.Driver first = drivers.isEmpty() ? null : drivers.get(0);
        FleetResources.Driver second = drivers.size() > 1 ? drivers.get(1) : null;
        List<Stage> plan = stages.listBySubject(tenantCode, Stage.SUBJECT_TRIP, tripId);
        Optional<Location> origin = location(tenantCode, t.originId());
        Optional<Location> destination = location(tenantCode, t.destinationId());

        live.upsert(new TripLiveProjection(t.id(), tenantCode, mandateCodes(tenantCode, tripId),
                truck.map(FleetResources.Vehicle::licensePlate).orElse(null),
                origin.map(l -> truncate(l.name(), LABEL_MAX)).orElse(null),
                destination.map(l -> truncate(l.name(), LABEL_MAX)).orElse(null),
                origin.map(Location::geofenceId).orElse(null), destination.map(Location::geofenceId).orElse(null),
                stopGeofences(tenantCode, plan), serviceStatus(plan).orElse(t.status()),
                first == null ? null : first.rut(), first == null ? null : first.fullName(),
                first == null ? null : first.phone(),
                second == null ? null : second.rut(), second == null ? null : second.fullName(),
                second == null ? null : second.phone(),
                carrier.map(c -> c.id().toString()).orElse(null),
                carrier.map(FleetResources.Carrier::legalName).orElse(null),
                carrier.map(FleetResources.Carrier::phone).orElse(null),
                trailer.map(FleetResources.Vehicle::licensePlate).orElse(null),
                t.actualStart(), t.actualEnd(), eta(plan), typeLoad(tenantCode, tripId)));
    }

    /**
     * Refreshes several trips in id order, the order trips lock in, so two such calls cannot deadlock. The order is
     * the uuid text, as Postgres sorts them ({@code UUID.compareTo} compares signed longs).
     */
    public void refreshAll(String tenantCode, Collection<UUID> tripIds) {
        tripIds.stream().distinct().sorted(Comparator.comparing(UUID::toString))
                .forEach(id -> refresh(tenantCode, id));
    }

    /** The newest open window of that type whose resource the fleet knows. */
    private Optional<FleetResources.Vehicle> latestVehicle(String tenantCode, List<Assignment> open, String type) {
        return open.stream().filter(a -> type.equals(a.resourceType()))
                .sorted(Comparator.comparing(Assignment::validFrom).reversed())
                .map(a -> fleet.vehicle(tenantCode, type, UUID.fromString(a.resourceId())))
                .flatMap(Optional::stream).findFirst();
    }

    private String mandateCodes(String tenantCode, UUID tripId) {
        List<Map<String, String>> codes = trips.mandatesOf(tenantCode, tripId).stream()
                .map(m -> {
                    Map<String, String> code = new LinkedHashMap<>();
                    code.put("mandate_id", m.mandateId());
                    code.put("code", m.externalCode());
                    return code;
                }).toList();
        return codes.isEmpty() ? null : Pg.json(codes);
    }

    private Optional<Location> location(String tenantCode, String locationId) {
        UUID id = Pg.parse(locationId);
        return id == null ? Optional.empty() : locations.find(tenantCode, id);
    }

    /** The geofences of the stop stages' locations, in stage order; null when none has one. */
    private List<Integer> stopGeofences(String tenantCode, List<Stage> plan) {
        List<Integer> ids = plan.stream().filter(s -> Stage.STOP.equals(s.stageType()))
                .sorted(Comparator.comparingInt(Stage::seq))
                .map(s -> location(tenantCode, s.locationId()).map(Location::geofenceId).orElse(null))
                .filter(Objects::nonNull).distinct().toList();
        return ids.isEmpty() ? null : ids;
    }

    /** The running stage's service status, else that of the stage that started last; empty when none declared one. */
    private static Optional<String> serviceStatus(List<Stage> plan) {
        return plan.stream()
                .filter(s -> s.serviceStatus() != null && !Stage.PENDING.equals(s.status()))
                .sorted(Comparator.comparing((Stage s) -> !Stage.RUNNING.equals(s.status()))
                        .thenComparing(Stage::actualStart, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Stage::seq, Comparator.reverseOrder()))
                .map(Stage::serviceStatus).findFirst();
    }

    /** The planned end of the last stage that has one. */
    private static OffsetDateTime eta(List<Stage> plan) {
        return plan.stream().filter(s -> s.plannedEnd() != null)
                .max(Comparator.comparingInt(Stage::seq)).map(Stage::plannedEnd).orElse(null);
    }

    private String typeLoad(String tenantCode, UUID tripId) {
        String load = cargo.listByTrip(tenantCode, tripId).stream()
                .map(CargoUnit::description).filter(Objects::nonNull).collect(Collectors.joining(" + "));
        return load.isEmpty() ? null : truncate(load, TYPE_LOAD_MAX);
    }

    /** The first {@code max} characters, counted as code points like the column's VARCHAR length. */
    private static String truncate(String text, int max) {
        return text.codePointCount(0, text.length()) <= max ? text
                : text.substring(0, text.offsetByCodePoints(0, max));
    }
}

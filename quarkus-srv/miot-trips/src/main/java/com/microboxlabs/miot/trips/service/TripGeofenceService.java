package com.microboxlabs.miot.trips.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.core.trips.TripGeofences;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.store.AssignmentStore;
import com.microboxlabs.miot.trips.store.GeofenceDirectory;
import com.microboxlabs.miot.trips.store.LocationStore;
import com.microboxlabs.miot.trips.store.Pg;
import com.microboxlabs.miot.trips.store.StageStore;
import com.microboxlabs.miot.trips.store.TripLiveStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.NoSuchElementException;
import java.util.UUID;

@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class TripGeofenceService implements TripGeofences {
    private record MapTrip(String tripId, String assetId, Integer originGeofenceId, Integer destinationGeofenceId,
            List<Integer> stopGeofenceIds) {
    }

    private final TripLiveStore live;
    private final TripStore trips;
    private final StageStore stages;
    private final LocationStore locations;
    private final AssignmentStore assignments;
    private final FleetResources fleet;
    private final GeofenceDirectory directory;
    private final ObjectMapper mapper;

    @Inject
    public TripGeofenceService(TripLiveStore live, TripStore trips, StageStore stages, LocationStore locations,
            AssignmentStore assignments, FleetResources fleet, GeofenceDirectory directory, ObjectMapper mapper) {
        this.live = live;
        this.trips = trips;
        this.stages = stages;
        this.locations = locations;
        this.assignments = assignments;
        this.fleet = fleet;
        this.directory = directory;
        this.mapper = mapper;
    }

    @Override
    public JsonNode geofences(String tenantCode, UUID tripId) {
        var trip = live.find(tenantCode, tripId)
                .map(row -> new MapTrip(row.tripId(), row.assetId(), row.originGeofenceId(),
                        row.destinationGeofenceId(), row.stopGeofenceIds()))
                .orElseGet(() -> persistent(tenantCode, tripId));
        List<Map.Entry<Integer, Integer>> roles = new ArrayList<>();
        if (trip.originGeofenceId() != null) roles.add(Map.entry(trip.originGeofenceId(), 1));
        if (trip.destinationGeofenceId() != null) roles.add(Map.entry(trip.destinationGeofenceId(), 2));
        if (trip.stopGeofenceIds() != null) {
            trip.stopGeofenceIds().stream().filter(Objects::nonNull).forEach(id -> roles.add(Map.entry(id, 3)));
        }
        Map<Integer, GeofenceDirectory.Geofence> owned = new LinkedHashMap<>();
        roles.stream().map(Map.Entry::getKey).distinct()
                .forEach(id -> directory.find(tenantCode, id).ifPresent(g -> owned.put(id, g)));
        var shapes = directory.shapes(owned.keySet());
        ArrayNode result = mapper.createArrayNode();
        roles.forEach(role -> {
            int id = role.getKey();
            var geofence = owned.get(id);
            String shape = shapes.get(id);
            if (geofence == null || shape == null) return;
            var item = result.addObject().put("trip_id", trip.tripId()).put("asset_id", trip.assetId());
            var zone = item.putObject("zone").put("id", id).put("name", geofence.name())
                    .put("code", geofence.code()).put("location_type", role.getValue());
            try {
                JsonNode geometry = mapper.readTree(shape);
                zone.set("location", geometry);
                zone.put("type", geometry.path("type").asText());
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("Invalid geofence shape", e);
            }
        });
        return result;
    }

    private MapTrip persistent(String tenantCode, UUID tripId) {
        var trip = trips.find(tenantCode, tripId).orElseThrow(() -> new NoSuchElementException("trip not found"));
        var stops = stages.listBySubject(tenantCode, Stage.SUBJECT_TRIP, tripId).stream()
                .filter(stage -> Stage.STOP.equals(stage.stageType()))
                .sorted(Comparator.comparingInt(Stage::seq))
                .map(stage -> geofenceId(tenantCode, stage.locationId())).filter(Objects::nonNull).distinct().toList();
        String asset = assignments.listByTrip(tenantCode, tripId).stream()
                .filter(assignment -> Assignment.TRUCK.equals(assignment.resourceType()))
                .sorted(Comparator.comparing(Assignment::validFrom).reversed())
                .map(assignment -> fleet.vehicle(tenantCode, Assignment.TRUCK, UUID.fromString(assignment.resourceId())))
                .flatMap(java.util.Optional::stream).findFirst().map(FleetResources.Vehicle::licensePlate).orElse(null);
        return new MapTrip(trip.id(), asset, geofenceId(tenantCode, trip.originId()),
                geofenceId(tenantCode, trip.destinationId()), stops);
    }

    private Integer geofenceId(String tenantCode, String locationId) {
        UUID id = Pg.parse(locationId);
        return id == null ? null : locations.find(tenantCode, id).map(Location::geofenceId).orElse(null);
    }
}

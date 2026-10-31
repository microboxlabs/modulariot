package com.microboxlabs.miot.trips.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.microboxlabs.miot.core.trips.TripGeofences;
import com.microboxlabs.miot.trips.store.GeofenceDirectory;
import com.microboxlabs.miot.trips.store.TripLiveStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.NoSuchElementException;
import java.util.UUID;

@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class TripGeofenceService implements TripGeofences {
    private final TripLiveStore trips;
    private final GeofenceDirectory directory;
    private final ObjectMapper mapper;

    @Inject
    public TripGeofenceService(TripLiveStore trips, GeofenceDirectory directory, ObjectMapper mapper) {
        this.trips = trips;
        this.directory = directory;
        this.mapper = mapper;
    }

    @Override
    public JsonNode geofences(String tenantCode, UUID tripId) {
        var trip = trips.find(tenantCode, tripId).orElseThrow(() -> new NoSuchElementException("trip not found"));
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
}

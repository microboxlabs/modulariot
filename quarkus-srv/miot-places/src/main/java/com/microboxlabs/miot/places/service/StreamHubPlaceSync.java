package com.microboxlabs.miot.places.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.core.gps.GpsDatabase;
import com.microboxlabs.miot.places.store.PlaceStore;
import com.microboxlabs.miot.places.store.PlaceStore.Place;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * {@link PlaceSync} on the GPS {@code geofences}: a geofence and each inner geofence is the row of its organization
 * and code ({@code client_id}, {@code client_geofence_id}), upserted with the place's name, shape and properties
 * (with its address); a delete removes the row for good. A route has none.
 *
 * <p>A row miot-trips keeps for a location ({@code properties.created_by = 'miot-trips'}) is never replaced or
 * removed: saving a place over one fails, and the place stays pending. Off while {@code miot.places.sync.enabled} is
 * false or the GPS database is not configured; what is written meanwhile stays pending.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class StreamHubPlaceSync implements PlaceSync {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String NOT_TRIPS = "(geofences.properties->>'created_by' = 'miot-trips') IS NOT TRUE";
    // polygon_type and geofence_classification as StreamHub's own polygons; an existing row keeps its own
    private static final String UPSERT = """
            INSERT INTO geofences (coordinates, client_geofence_id, client_id, geofence_name,
                geofence_classification, polygon_type, created_at, updated_at, properties)
            VALUES (ST_SetSRID(ST_GeomFromGeoJSON($4::text), 4326)::geography, $2, $1, $3, 1, 'polygonal', now(),
                now(), $5::text::jsonb)
            ON CONFLICT (client_id, client_geofence_id) DO UPDATE
               SET coordinates = EXCLUDED.coordinates, geofence_name = EXCLUDED.geofence_name, updated_at = now(),
                   properties = EXCLUDED.properties
             WHERE\s""" + NOT_TRIPS + " RETURNING geofence_id";
    private static final String DELETE = "DELETE FROM geofences WHERE client_id = $1 AND client_geofence_id = $2 AND "
            + NOT_TRIPS;

    private final GpsDatabase gps;
    private final boolean enabled;

    @Inject
    public StreamHubPlaceSync(GpsDatabase gps,
            @ConfigProperty(name = "miot.places.sync.enabled", defaultValue = "true") boolean enabled) {
        this.gps = gps;
        this.enabled = enabled;
    }

    @Override
    public void saved(String tenantCode, String externalCode, Place place) {
        if (!PlaceStore.SYNCED_KINDS.contains(place.kind())) {
            return;
        }
        JsonNode feature = json(place.geojson());
        ObjectNode properties = feature.path("properties").isObject()
                ? ((ObjectNode) feature.get("properties")).deepCopy()
                : MAPPER.createObjectNode();
        if (place.address() != null) {
            properties.put("address", place.address());
        }
        boolean written = gps.pool().preparedQuery(UPSERT)
                .execute(Tuple.of(tenantCode, externalCode, place.name(),
                        feature.path("geometry").toString(), properties.toString()))
                .await().atMost(TIMEOUT).iterator().hasNext();
        if (!written) {
            throw new IllegalStateException("the GPS geofence " + tenantCode + "/" + externalCode
                    + " is a miot-trips location's; it is not replaced");
        }
    }

    @Override
    public void deleted(String tenantCode, String externalCode, String kind) {
        if (PlaceStore.SYNCED_KINDS.contains(kind)) {
            gps.pool().preparedQuery(DELETE).execute(Tuple.of(tenantCode, externalCode))
                    .await().atMost(TIMEOUT);
        }
    }

    @Override
    public boolean copies() {
        return enabled && gps.configured();
    }

    private static JsonNode json(String text) {
        try {
            return MAPPER.readTree(text);
        } catch (Exception e) {
            throw new IllegalArgumentException("the place's geojson is not valid JSON", e);
        }
    }
}

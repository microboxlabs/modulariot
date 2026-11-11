package com.microboxlabs.miot.places.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.microboxlabs.miot.core.gps.GpsDatabase;
import com.microboxlabs.miot.places.store.PlaceStore;
import com.microboxlabs.miot.places.store.PlaceStore.Place;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.runtime.StartupEvent;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.time.Duration;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * {@link PlaceSync} on the GPS {@code geofences}: a geofence and each inner geofence is the row of its organization
 * and code ({@code client_id}, {@code client_geofence_id}), upserted with the place's name, shape and properties
 * (with its address); a delete removes the row for good. A route has none.
 *
 * <p>Only rows created by this sync may be replaced or removed. A collision with a legacy row leaves the place
 * pending. Deletes also match the source place ID, protecting a newer owner of the code. On with the places
 * component; off while {@code miot.places.sync.enabled} is false (in dev by default) or the GPS database is not
 * configured; what is written meanwhile stays pending.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class StreamHubPlaceSync implements PlaceSync {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Logger LOG = Logger.getLogger(StreamHubPlaceSync.class);
    private static final String OWNED = "geofences.properties->>'created_by' = 'miot-places'"
            + " AND geofences.properties->>'miot_place_id' IS NOT NULL";
    // polygon_type and geofence_classification as StreamHub's own polygons; an existing row keeps its own
    private static final String UPSERT = """
            INSERT INTO geofences (coordinates, client_geofence_id, client_id, geofence_name,
                geofence_classification, polygon_type, created_at, updated_at, properties)
            VALUES (ST_SetSRID(ST_GeomFromGeoJSON($4::text), 4326)::geography, $2, $1, $3, 1, 'polygonal', now(),
                now(), $5::text::jsonb)
            ON CONFLICT (client_id, client_geofence_id) DO UPDATE
               SET coordinates = EXCLUDED.coordinates, geofence_name = EXCLUDED.geofence_name, updated_at = now(),
                   properties = EXCLUDED.properties
             WHERE\s""" + OWNED + " RETURNING geofence_id";
    private static final String DELETE = "DELETE FROM geofences WHERE client_id = $1 AND client_geofence_id = $2 AND "
            + OWNED + " AND geofences.properties->>'miot_place_id' = $3";

    private final GpsDatabase gps;
    private final boolean enabled;

    @Inject
    public StreamHubPlaceSync(GpsDatabase gps,
            @ConfigProperty(name = "miot.places.sync.enabled", defaultValue = "true") boolean enabled,
            @ConfigProperty(name = "miot.component.places.enabled", defaultValue = "false") boolean componentEnabled) {
        this.gps = gps;
        this.enabled = enabled && componentEnabled;
    }

    public StreamHubPlaceSync(GpsDatabase gps, boolean enabled) {
        this(gps, enabled, true);
    }

    void starting(@Observes StartupEvent event) {
        if (!enabled) {
            LOG.info("places sync: skipped (places component or sync disabled)");
        } else if (!gps.configured()) {
            LOG.info("places sync: skipped (GPS datasource not configured); places stay pending");
        } else {
            LOG.info("places sync: enabled; only geofences owned by miot-places are changed");
        }
    }

    @Override
    public void saved(String tenantCode, String externalCode, Place place) {
        requireKey(tenantCode, externalCode, place);
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
        // Reserved ownership fields come from the source row, never from user-supplied GeoJSON properties.
        properties.put("created_by", "miot-places");
        properties.put("miot_place_id", place.id().toString());
        boolean written = gps.pool().preparedQuery(UPSERT)
                .execute(Tuple.of(tenantCode, externalCode, place.name(),
                        feature.path("geometry").toString(), properties.toString()))
                .await().atMost(TIMEOUT).iterator().hasNext();
        if (!written) {
            throw new IllegalStateException("the GPS geofence " + tenantCode + "/" + externalCode
                    + " is not owned by miot-places; it is not replaced");
        }
    }

    @Override
    public void deleted(String tenantCode, String externalCode, Place place) {
        requireKey(tenantCode, externalCode, place);
        if (PlaceStore.SYNCED_KINDS.contains(place.kind())) {
            gps.pool().preparedQuery(DELETE).execute(Tuple.of(tenantCode, externalCode, place.id().toString()))
                    .await().atMost(TIMEOUT);
        }
    }

    @Override
    public boolean copies() {
        return enabled && gps.configured();
    }

    private static void requireKey(String tenantCode, String externalCode, Place place) {
        if (place.id() == null || !place.tenantCode().equals(tenantCode) || !place.externalCode().equals(externalCode)) {
            throw new IllegalArgumentException("sync key must match the source place's organization, code and ID");
        }
    }

    private static JsonNode json(String text) {
        try {
            return MAPPER.readTree(text);
        } catch (Exception e) {
            throw new IllegalArgumentException("the place's geojson is not valid JSON", e);
        }
    }
}

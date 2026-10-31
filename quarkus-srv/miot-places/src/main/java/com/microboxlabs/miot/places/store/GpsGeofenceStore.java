package com.microboxlabs.miot.places.store;

import com.microboxlabs.miot.core.gps.GpsDatabase;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * {@link GeofenceStore} on the GPS database's {@code geofences} table. Reads use read-only sessions, never inside
 * the modulith's transaction. {@code geofence_category} is not deployed in every GPS database, so it is read
 * through the row's JSON: null where the column does not exist instead of failing the query.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class GpsGeofenceStore implements GeofenceStore {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final String COLUMNS = """
            geofence_id, client_geofence_id, geofence_name, polygon_type,
            to_jsonb(g) ->> 'geofence_category' AS category,
            ST_AsGeoJSON(coordinates::geometry) AS shape, properties::text AS properties""";

    private final GpsDatabase gps;

    @Inject
    GpsGeofenceStore(GpsDatabase gps) {
        this.gps = gps;
    }

    @Override
    public List<Geofence> list(String tenantCode, String q, int limit, long offset) {
        if (!gps.configured()) {
            throw new GeofencesUnavailableException("The GPS database is not configured");
        }
        String sql = "SELECT " + COLUMNS + " FROM geofences g WHERE client_id = $1"
                + (q == null ? "" : " AND (geofence_name ILIKE $4 OR client_geofence_id ILIKE $4)")
                + " ORDER BY geofence_name, geofence_id LIMIT $2 OFFSET $3";
        Tuple params = Tuple.of(tenantCode, limit, offset);
        if (q != null) {
            params.addString("%" + q + "%");
        }
        List<Geofence> out = new ArrayList<>();
        gps.readPool().preparedQuery(sql).execute(params).await().atMost(TIMEOUT)
                .forEach(r -> out.add(geofence(r)));
        return out;
    }

    private static Geofence geofence(Row r) {
        return new Geofence(r.getInteger("geofence_id"), r.getString("client_geofence_id"),
                r.getString("geofence_name"), r.getString("polygon_type"), r.getString("category"),
                r.getString("shape"),
                r.getString("properties"));
    }
}

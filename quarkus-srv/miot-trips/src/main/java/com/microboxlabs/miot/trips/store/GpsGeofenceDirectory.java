package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.core.gps.GpsDatabase;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * {@link GeofenceDirectory} on the GPS database's {@code geofences} table. Read-only sessions, never inside the
 * modulith's transaction.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class GpsGeofenceDirectory implements GeofenceDirectory {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final String COLUMNS = "geofence_id, client_geofence_id, geofence_name";

    private final GpsDatabase gps;

    @Inject
    GpsGeofenceDirectory(GpsDatabase gps) {
        this.gps = gps;
    }

    @Override
    public List<Geofence> search(String tenantCode, String q, int limit) {
        if (!gps.configured()) {
            return List.of();
        }
        String sql = "SELECT " + COLUMNS + " FROM geofences WHERE client_id = $1"
                + (q == null ? "" : " AND (geofence_name ILIKE $3 OR client_geofence_id ILIKE $3)")
                + " ORDER BY geofence_name, geofence_id LIMIT $2";
        Tuple params = Tuple.of(tenantCode, limit);
        if (q != null) {
            params.addString("%" + q + "%");
        }
        List<Geofence> out = new ArrayList<>();
        gps.readPool().preparedQuery(sql).execute(params).await().atMost(TIMEOUT)
                .forEach(r -> out.add(geofence(r)));
        return out;
    }

    @Override
    public Optional<Geofence> find(String tenantCode, int id) {
        if (!gps.configured()) {
            return Optional.empty();
        }
        var rows = gps.readPool()
                .preparedQuery("SELECT " + COLUMNS + " FROM geofences WHERE client_id = $1 AND geofence_id = $2")
                .execute(Tuple.of(tenantCode, id)).await().atMost(TIMEOUT);
        return rows.iterator().hasNext() ? Optional.of(geofence(rows.iterator().next())) : Optional.empty();
    }

    @Override
    public Map<Integer, String> shapes(Collection<Integer> ids) {
        Map<Integer, String> out = new HashMap<>();
        if (ids.isEmpty() || !gps.configured()) {
            return out;
        }
        gps.readPool().preparedQuery("""
                SELECT geofence_id, ST_AsGeoJSON(coordinates::geometry) AS shape
                FROM geofences WHERE geofence_id = ANY($1)""")
                .execute(Tuple.of(ids.toArray(Integer[]::new))).await().atMost(TIMEOUT)
                .forEach(r -> out.put(r.getInteger("geofence_id"), r.getString("shape")));
        return out;
    }

    private static Geofence geofence(Row r) {
        return new Geofence(r.getInteger("geofence_id"), r.getString("client_geofence_id"),
                r.getString("geofence_name"));
    }
}

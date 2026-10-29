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
 * {@link GeofenceDirectory} on the GPS database's {@code geofences} table, never inside the modulith's transaction.
 * Reads use read-only sessions; {@link #create} writes with the tenant's client id.
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
    public List<Geofence> matching(String tenantCode, String code, String name, int limit) {
        if (!gps.configured() || (code == null && name == null)) {
            return List.of();
        }
        List<Geofence> out = new ArrayList<>();
        gps.readPool().preparedQuery("SELECT " + COLUMNS + """
                 FROM geofences
                WHERE client_id = $1 AND (client_geofence_id = $2 OR lower(geofence_name) = lower($3))
                ORDER BY client_geofence_id = $2 DESC NULLS LAST, geofence_id LIMIT $4""")
                .execute(Tuple.of(tenantCode, code, name, limit)).await().atMost(TIMEOUT)
                .forEach(r -> out.add(geofence(r)));
        return out;
    }

    @Override
    public Optional<Geofence> create(String tenantCode, String code, String name, String area, String properties) {
        if (tenantCode == null || tenantCode.isBlank()) {
            throw new IllegalArgumentException("a geofence needs the tenant's client id");
        }
        if (!gps.configured()) {
            return Optional.empty();
        }
        var rows = gps.pool().preparedQuery("""
                INSERT INTO geofences (coordinates, client_geofence_id, client_id, geofence_name,
                    geofence_classification, polygon_type, created_at, updated_at, properties)
                VALUES (ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography, $2, $1, $3, 1, 'point', now(), now(),
                    $5::jsonb)
                ON CONFLICT (client_id, client_geofence_id) DO NOTHING
                RETURNING\s""" + COLUMNS)
                .execute(Tuple.of(tenantCode, code, name, area, properties)).await().atMost(TIMEOUT);
        if (rows.iterator().hasNext()) {
            return Optional.of(geofence(rows.iterator().next()));
        }
        return matching(tenantCode, code, null, 1).stream().findFirst();
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

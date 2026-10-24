package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.microboxlabs.miot.trips.domain.Location;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link LocationStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgLocationStore implements LocationStore {

    private static final String COLUMNS = """
            id, tenant_code, name, type, external_code, geom_geojson::text AS geom_geojson,
            created_at, created_by, updated_at, updated_by""";

    private final Supplier<Pool> pool;

    @Inject
    PgLocationStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgLocationStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Location insert(Location l) {
        return location(query(pool.get(), """
                INSERT INTO miot_trips.location
                    (tenant_code, name, type, external_code, geom_geojson, created_by, updated_by)
                VALUES ($1, $2, $3, $4, $5::text::jsonb, $6, $6)
                RETURNING\s""" + COLUMNS,
                Tuple.tuple().addString(l.tenantCode()).addString(l.name()).addString(l.type())
                        .addString(l.externalCode()).addString(l.geomGeojson()).addString(l.createdBy()))
                .iterator().next());
    }

    @Override
    public Optional<Location> find(String tenantCode, UUID id) {
        return first(query(pool.get(),
                "SELECT " + COLUMNS + " FROM miot_trips.location WHERE tenant_code = $1 AND id = $2",
                Tuple.of(tenantCode, id)));
    }

    @Override
    public List<Location> list(String tenantCode, String q, String type, int page, int size) {
        StringBuilder sql = new StringBuilder("SELECT ").append(COLUMNS)
                .append(" FROM miot_trips.location WHERE tenant_code = $1 AND version_of IS NULL");
        Tuple params = Tuple.of(tenantCode);
        if (q != null) {
            params.addString("%" + q + "%");
            int n = params.size();
            sql.append(" AND (name ILIKE $").append(n).append(" OR external_code ILIKE $").append(n).append(')');
        }
        if (type != null) {
            params.addString(type);
            sql.append(" AND type = $").append(params.size());
        }
        params.addInteger(size);
        sql.append(" ORDER BY name, id LIMIT $").append(params.size());
        params.addInteger(page * size);
        sql.append(" OFFSET $").append(params.size());
        return query(pool.get(), sql.toString(), params).stream().map(PgLocationStore::location).toList();
    }

    @Override
    public Optional<Location> update(Location l) {
        return first(query(pool.get(), """
                UPDATE miot_trips.location SET
                    name = $3, type = $4, external_code = $5, geom_geojson = $6::text::jsonb, updated_by = $7
                WHERE id = $1 AND tenant_code = $2
                RETURNING\s""" + COLUMNS,
                Tuple.tuple().addUUID(Pg.parse(l.id())).addString(l.tenantCode())
                        .addString(l.name()).addString(l.type()).addString(l.externalCode())
                        .addString(l.geomGeojson()).addString(l.updatedBy())));
    }

    private static Optional<Location> first(RowSet<Row> rows) {
        for (Row r : rows) {
            return Optional.of(location(r));
        }
        return Optional.empty();
    }

    private static Location location(Row r) {
        return new Location(text(r.getUUID("id")), r.getString("tenant_code"), r.getString("name"),
                r.getString("type"), r.getString("external_code"), r.getString("geom_geojson"),
                time(r, "created_at"), r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"));
    }
}

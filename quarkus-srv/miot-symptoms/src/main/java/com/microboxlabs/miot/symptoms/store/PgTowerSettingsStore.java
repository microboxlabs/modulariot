package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.store.PgIds.query;

import com.microboxlabs.miot.symptoms.domain.TowerSettings;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowIterator;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.Optional;
import java.util.function.Supplier;

/** {@link TowerSettingsStore} on the modulith database, schema {@code miot_symptoms}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgTowerSettingsStore implements TowerSettingsStore {

    private static final String COLUMNS =
            "tenant_code, operators, shift_hours, capacity_per_shift, updated_by, updated_at";

    private static final String SELECT = "SELECT " + COLUMNS
            + " FROM miot_symptoms.tower_settings WHERE tenant_code = $1";

    private static final String UPSERT = "INSERT INTO miot_symptoms.tower_settings (" + COLUMNS + """
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (tenant_code) DO UPDATE SET operators = EXCLUDED.operators,
                shift_hours = EXCLUDED.shift_hours, capacity_per_shift = EXCLUDED.capacity_per_shift,
                updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at
            RETURNING\s""" + COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgTowerSettingsStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgTowerSettingsStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Optional<TowerSettings> find(String tenantCode) {
        RowIterator<Row> rows = query(pool.get(), SELECT, Tuple.of(tenantCode)).iterator();
        return rows.hasNext() ? Optional.of(settings(rows.next())) : Optional.empty();
    }

    @Override
    public TowerSettings save(TowerSettings s) {
        Tuple params = Tuple.tuple().addValue(s.tenantCode()).addValue(s.operators()).addValue(s.shiftHours())
                .addValue(s.capacityPerShift()).addValue(s.updatedBy()).addValue(s.updatedAt());
        return settings(query(pool.get(), UPSERT, params).iterator().next());
    }

    private static TowerSettings settings(Row r) {
        return new TowerSettings(r.getString("tenant_code"), r.getInteger("operators"), r.getInteger("shift_hours"),
                r.getInteger("capacity_per_shift"), r.getString("updated_by"), r.getOffsetDateTime("updated_at"));
    }
}

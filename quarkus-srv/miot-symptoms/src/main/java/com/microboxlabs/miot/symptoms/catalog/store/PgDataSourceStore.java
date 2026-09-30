package com.microboxlabs.miot.symptoms.catalog.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceKind;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/** {@link DataSourceStore} on the modulith database, schema {@code miot_symptoms}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgDataSourceStore implements DataSourceStore {

    private static final TypeReference<List<SourceField>> FIELDS = new TypeReference<>() {
    };
    private static final TypeReference<List<Map<String, Object>>> SAMPLES = new TypeReference<>() {
    };

    private static final String COLUMNS = "id, tenant_code, source_key, name, kind, root, cadence, fields, samples";

    // Platform rows first, so an organization's own source with the same key replaces them in list().
    private static final String SELECT_VISIBLE = "SELECT " + COLUMNS + """
             FROM miot_symptoms.data_source
            WHERE tenant_code IS NULL OR tenant_code = $1
            ORDER BY tenant_code NULLS FIRST, name""";

    private static final String UPSERT = """
            INSERT INTO miot_symptoms.data_source (
                id, tenant_code, source_key, name, kind, root, cadence, fields, samples
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
            ON CONFLICT (COALESCE(tenant_code, ''), source_key) DO UPDATE SET
                name = EXCLUDED.name, kind = EXCLUDED.kind, root = EXCLUDED.root, cadence = EXCLUDED.cadence,
                fields = EXCLUDED.fields, samples = EXCLUDED.samples, updated_at = now()
            RETURNING\s""" + COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgDataSourceStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgDataSourceStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<DataSource> list(String tenantCode) {
        Map<String, DataSource> byKey = new LinkedHashMap<>();
        for (DataSource s : sources(query(SELECT_VISIBLE, Tuple.of(tenantCode)))) {
            byKey.put(s.key(), s);
        }
        return new ArrayList<>(byKey.values());
    }

    @Override
    public Optional<DataSource> find(String tenantCode, String key) {
        return list(tenantCode).stream().filter(s -> s.key().equals(key)).findFirst();
    }

    @Override
    public DataSource upsert(DataSource s) {
        Tuple params = Tuple.tuple()
                .addUUID(s.id()).addString(s.tenantCode()).addString(s.key()).addString(s.name())
                .addString(s.kind().name()).addString(s.root()).addString(s.cadence())
                .addString(PgJson.write(s.fields())).addString(PgJson.write(s.samples()));
        return sources(query(UPSERT, params)).get(0);
    }

    private RowSet<Row> query(String sql, Tuple params) {
        return pool.get().preparedQuery(sql).execute(params).await().atMost(QUERY_TIMEOUT);
    }

    private static List<DataSource> sources(RowSet<Row> rows) {
        return rows.stream().map(r -> new DataSource(r.getUUID("id"), r.getString("tenant_code"),
                r.getString("source_key"), r.getString("name"), SourceKind.valueOf(r.getString("kind")),
                r.getString("root"), r.getString("cadence"), PgJson.read(r, "fields", FIELDS),
                PgJson.read(r, "samples", SAMPLES))).toList();
    }
}

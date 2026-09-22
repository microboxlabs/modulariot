package com.microboxlabs.miot.symptoms.persistence;

import com.microboxlabs.miot.symptoms.domain.Selectable;
import com.microboxlabs.miot.symptoms.domain.SelectableOption;
import com.microboxlabs.miot.symptoms.domain.SelectionMode;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Selectable catalogs and field bindings in {@code miot_symptoms}. */
@ApplicationScoped
public class SelectableRepository {

    private static final String COLUMNS = "tenant_code, key, name, description, mode, options, updated_by, updated_at";

    private static final String LIST = """
            SELECT %s FROM miot_symptoms.selectables WHERE tenant_code = $1 ORDER BY key""".formatted(COLUMNS);

    private static final String FIND = """
            SELECT %s FROM miot_symptoms.selectables WHERE tenant_code = $1 AND key = $2""".formatted(COLUMNS);

    private static final String UPSERT = """
            INSERT INTO miot_symptoms.selectables (tenant_code, key, name, description, mode, options, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (tenant_code, key) DO UPDATE SET
                name = EXCLUDED.name, description = EXCLUDED.description, mode = EXCLUDED.mode,
                options = EXCLUDED.options, updated_by = EXCLUDED.updated_by, updated_at = now()
            RETURNING %s""".formatted(COLUMNS);

    private static final String INSERT_IF_ABSENT = """
            INSERT INTO miot_symptoms.selectables (tenant_code, key, name, description, mode, options, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (tenant_code, key) DO NOTHING""";

    private static final String LIST_BINDINGS = """
            SELECT field_key, selectable_key FROM miot_symptoms.selectable_bindings WHERE tenant_code = $1""";

    private static final String UPSERT_BINDING = """
            INSERT INTO miot_symptoms.selectable_bindings (tenant_code, field_key, selectable_key, updated_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (tenant_code, field_key) DO UPDATE SET
                selectable_key = EXCLUDED.selectable_key, updated_by = EXCLUDED.updated_by, updated_at = now()""";

    private final Instance<Pool> clientInstance;

    protected SelectableRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public List<Selectable> list(String tenantCode) {
        RowSet<Row> rows = client().preparedQuery(LIST).execute(Tuple.of(tenantCode)).await().indefinitely();
        List<Selectable> out = new ArrayList<>();
        rows.forEach(row -> out.add(map(row)));
        return out;
    }

    public Optional<Selectable> find(String tenantCode, String key) {
        RowSet<Row> rows = client().preparedQuery(FIND).execute(Tuple.of(tenantCode, key)).await().indefinitely();
        return rows.iterator().hasNext() ? Optional.of(map(rows.iterator().next())) : Optional.empty();
    }

    public Selectable upsert(Selectable s) {
        RowSet<Row> rows = client().preparedQuery(UPSERT).execute(params(s)).await().indefinitely();
        return rows.iterator().hasNext() ? map(rows.iterator().next()) : null;
    }

    /** Seeds one selectable without touching an existing row; returns true when inserted. */
    public boolean insertIfAbsent(Selectable s) {
        return client().preparedQuery(INSERT_IF_ABSENT).execute(params(s)).await().indefinitely().rowCount() > 0;
    }

    public Map<String, String> listBindings(String tenantCode) {
        RowSet<Row> rows = client().preparedQuery(LIST_BINDINGS).execute(Tuple.of(tenantCode)).await().indefinitely();
        Map<String, String> out = new LinkedHashMap<>();
        rows.forEach(row -> out.put(row.getString("field_key"), row.getString("selectable_key")));
        return out;
    }

    public void upsertBinding(String tenantCode, String fieldKey, String selectableKey, String actor) {
        client().preparedQuery(UPSERT_BINDING)
                .execute(Tuple.of(tenantCode, fieldKey, selectableKey, actor)).await().indefinitely();
    }

    private static Tuple params(Selectable s) {
        JsonArray options = new JsonArray();
        for (SelectableOption o : s.options()) {
            options.add(new JsonObject()
                    .put("id", o.id())
                    .put("name", o.name())
                    .put("description", o.description()));
        }
        return Tuple.tuple()
                .addString(s.tenantCode())
                .addString(s.key())
                .addString(s.name())
                .addString(s.description())
                .addString(s.mode().name())
                .addJsonArray(options)
                .addString(s.updatedBy());
    }

    private Pool client() {
        return clientInstance.get();
    }

    private Selectable map(Row row) {
        List<SelectableOption> options = new ArrayList<>();
        JsonArray array = row.getJsonArray("options");
        if (array != null) {
            for (int i = 0; i < array.size(); i++) {
                JsonObject o = array.getJsonObject(i);
                options.add(new SelectableOption(o.getString("id"), o.getString("name"), o.getString("description")));
            }
        }
        return new Selectable(
                row.getString("tenant_code"),
                row.getString("key"),
                row.getString("name"),
                row.getString("description"),
                SelectionMode.valueOf(row.getString("mode")),
                options,
                row.getString("updated_by"),
                row.getOffsetDateTime("updated_at"));
    }
}

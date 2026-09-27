package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.ModelProvider;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Storage for the platform's model providers (Vert.x reactive PG with a bounded
 * blocking wait, like {@code HarnessThreadRepository}). The {@code protected}
 * constructor lets unit tests subclass with no pool.
 */
@ApplicationScoped
public class ModelProviderRepository {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);

    private static final String COLUMNS =
            "provider, base_url, encrypted_key, key_preview, models, enabled, updated_by, updated_at";

    private static final String LIST = "SELECT " + COLUMNS
            + " FROM miot_integrations.model_providers ORDER BY provider";

    private static final String FIND = "SELECT " + COLUMNS
            + " FROM miot_integrations.model_providers WHERE provider = $1";

    private static final String UPSERT = """
            INSERT INTO miot_integrations.model_providers (
                provider, base_url, encrypted_key, key_preview, models, enabled, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (provider) DO UPDATE
                SET base_url = EXCLUDED.base_url,
                    encrypted_key = EXCLUDED.encrypted_key,
                    key_preview = EXCLUDED.key_preview,
                    models = EXCLUDED.models,
                    enabled = EXCLUDED.enabled,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = now()
            RETURNING\s""" + COLUMNS;

    private static final String DELETE = "DELETE FROM miot_integrations.model_providers WHERE provider = $1";

    private final Instance<Pool> clientInstance;

    @Inject
    public ModelProviderRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public List<ModelProvider> list() {
        List<ModelProvider> out = new ArrayList<>();
        for (Row row : execute(LIST, Tuple.tuple())) {
            out.add(map(row));
        }
        return out;
    }

    public ModelProvider find(String provider) {
        RowSet<Row> rows = execute(FIND, Tuple.of(provider));
        return rows.iterator().hasNext() ? map(rows.iterator().next()) : null;
    }

    public ModelProvider upsert(ModelProvider p) {
        Tuple params = Tuple.tuple()
                .addString(p.provider())
                .addString(p.baseUrl())
                .addString(p.encryptedKey())
                .addString(p.keyPreview())
                .addValue(toJson(p.models()))
                .addBoolean(p.enabled())
                .addString(p.updatedBy());
        return map(execute(UPSERT, params).iterator().next());
    }

    public boolean delete(String provider) {
        return execute(DELETE, Tuple.of(provider)).rowCount() > 0;
    }

    private RowSet<Row> execute(String sql, Tuple params) {
        Uni<RowSet<Row>> query = clientInstance.get().preparedQuery(sql).execute(params);
        return query.await().atMost(QUERY_TIMEOUT);
    }

    private static ModelProvider map(Row row) {
        return new ModelProvider(
                row.getString("provider"),
                row.getString("base_url"),
                row.getString("encrypted_key"),
                row.getString("key_preview"),
                fromJson(row.getJsonArray("models")),
                row.getBoolean("enabled"),
                row.getString("updated_by"),
                row.getOffsetDateTime("updated_at"));
    }

    static JsonArray toJson(List<ModelProvider.Model> models) {
        JsonArray out = new JsonArray();
        for (ModelProvider.Model m : models) {
            JsonObject o = new JsonObject().put("id", m.id()).put("default", m.isDefault());
            if (m.inputPerMtok() != null) {
                o.put("inputPerMtok", m.inputPerMtok().toPlainString());
            }
            if (m.outputPerMtok() != null) {
                o.put("outputPerMtok", m.outputPerMtok().toPlainString());
            }
            out.add(o);
        }
        return out;
    }

    static List<ModelProvider.Model> fromJson(JsonArray models) {
        List<ModelProvider.Model> out = new ArrayList<>();
        if (models == null) {
            return out;
        }
        for (int i = 0; i < models.size(); i++) {
            JsonObject o = models.getJsonObject(i);
            out.add(new ModelProvider.Model(
                    o.getString("id"),
                    decimal(o.getValue("inputPerMtok")),
                    decimal(o.getValue("outputPerMtok")),
                    Boolean.TRUE.equals(o.getBoolean("default"))));
        }
        return out;
    }

    private static BigDecimal decimal(Object value) {
        return value == null ? null : new BigDecimal(value.toString());
    }
}

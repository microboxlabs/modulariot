package com.microboxlabs.miot.conversational.rules.store;

import static com.microboxlabs.miot.conversational.rules.store.Pg.SELECT;
import static com.microboxlabs.miot.conversational.rules.store.Pg.instant;
import static com.microboxlabs.miot.conversational.rules.store.Pg.query;
import static com.microboxlabs.miot.conversational.rules.store.Pg.time;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.conversational.rules.EventCatalog;
import com.microboxlabs.miot.conversational.rules.ExternalEventType;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/** {@link ExternalEventStore} on {@code miot_conversational.conv_external_event_type}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class PgExternalEventStore implements ExternalEventStore {

    private static final TypeReference<List<EventCatalog.Field>> FIELDS = new TypeReference<>() {
    };
    private static final String LIST = SELECT + """
            tenant_code, source, type, context_kind, description, fields::text AS fields, updated_at
              FROM miot_conversational.conv_external_event_type
             WHERE tenant_code = $1
             ORDER BY type""";
    /** One statement, so the source's old types go and its new ones arrive together. */
    private static final String REPLACE = """
            WITH incoming AS (
                SELECT x.type, x.context_kind, x.description, x.fields
                  FROM jsonb_to_recordset($3::text::jsonb)
                       AS x(type text, context_kind text, description text, fields jsonb)
            ), removed AS (
                DELETE FROM miot_conversational.conv_external_event_type t
                 WHERE t.tenant_code = $1 AND t.source = $2
                   AND t.type NOT IN (SELECT type FROM incoming)
            )
            INSERT INTO miot_conversational.conv_external_event_type
                (tenant_code, source, type, context_kind, description, fields, updated_at)
            SELECT $1, $2, i.type, i.context_kind, i.description, COALESCE(i.fields, '[]'::jsonb), $4
              FROM incoming i
            ON CONFLICT (tenant_code, type) DO UPDATE SET
                context_kind = EXCLUDED.context_kind,
                description = EXCLUDED.description, fields = EXCLUDED.fields, updated_at = EXCLUDED.updated_at
            WHERE miot_conversational.conv_external_event_type.source = EXCLUDED.source""";

    private final Supplier<Pool> pool;

    @Inject
    PgExternalEventStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgExternalEventStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<ExternalEventType> list(String tenantCode) {
        List<ExternalEventType> out = new ArrayList<>();
        query(pool.get(), LIST, Tuple.of(tenantCode)).forEach(r -> out.add(type(r)));
        return out;
    }

    @Override
    public void replace(String tenantCode, String source, List<ExternalEventType> types) {
        List<Map<String, Object>> rows = new ArrayList<>();
        Instant at = Instant.now();
        for (ExternalEventType t : types) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("type", t.type());
            row.put("context_kind", t.contextKind());
            row.put("description", t.description());
            row.put("fields", t.fields());
            rows.add(row);
            if (t.updatedAt() != null) {
                at = t.updatedAt();
            }
        }
        query(pool.get(), REPLACE,
                Tuple.tuple().addString(tenantCode).addString(source).addString(Pg.write(rows))
                        .addOffsetDateTime(time(at)));
    }

    private static ExternalEventType type(Row r) {
        List<EventCatalog.Field> fields;
        try {
            String text = r.getString("fields");
            fields = text == null ? List.of() : Pg.JSON.readValue(text, FIELDS);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Stored JSON is not valid", e);
        }
        return new ExternalEventType(r.getString("tenant_code"), r.getString("source"), r.getString("type"),
                r.getString("context_kind"), r.getString("description"), fields, instant(r, "updated_at"));
    }
}

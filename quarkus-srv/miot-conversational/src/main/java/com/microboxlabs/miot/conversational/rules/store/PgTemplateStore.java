package com.microboxlabs.miot.conversational.rules.store;

import static com.microboxlabs.miot.conversational.rules.store.Pg.SELECT;
import static com.microboxlabs.miot.conversational.rules.store.Pg.instant;
import static com.microboxlabs.miot.conversational.rules.store.Pg.query;
import static com.microboxlabs.miot.conversational.rules.store.Pg.string;
import static com.microboxlabs.miot.conversational.rules.store.Pg.time;
import static com.microboxlabs.miot.conversational.rules.store.Pg.uuid;

import com.microboxlabs.miot.conversational.rules.ConvTemplate;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

/** {@link TemplateStore} on {@code miot_conversational.conv_template}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class PgTemplateStore implements TemplateStore {

    private static final String COLUMNS = """
            id, tenant_code, key, name, base_text, whatsapp::text AS whatsapp, email::text AS email,
            created_at, updated_at, updated_by, version""";
    private static final String LIST = SELECT + COLUMNS
            + " FROM miot_conversational.conv_template WHERE tenant_code = $1 ORDER BY key";
    private static final String FIND = SELECT + COLUMNS
            + " FROM miot_conversational.conv_template WHERE tenant_code = $1 AND key = $2";
    private static final String UPSERT = """
            INSERT INTO miot_conversational.conv_template
                (id, tenant_code, key, name, base_text, whatsapp, email, created_at, updated_at, updated_by,
                 version)
            VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7::text::jsonb, $8, $8, $9, $10)
            ON CONFLICT (tenant_code, key) DO UPDATE SET
                name = EXCLUDED.name, base_text = EXCLUDED.base_text, whatsapp = EXCLUDED.whatsapp,
                email = EXCLUDED.email, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by,
                version = EXCLUDED.version
            WHERE miot_conversational.conv_template.version IS NOT DISTINCT FROM $11::varchar
            RETURNING\s""" + COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgTemplateStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgTemplateStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<ConvTemplate> list(String tenantCode) {
        return templates(query(pool.get(), LIST, Tuple.of(tenantCode)));
    }

    @Override
    public Optional<ConvTemplate> find(String tenantCode, String key) {
        return templates(query(pool.get(), FIND, Tuple.of(tenantCode, key))).stream().findFirst();
    }

    @Override
    public Optional<ConvTemplate> upsert(ConvTemplate t, String expectedVersion) {
        Tuple params = Tuple.tuple().addUUID(uuid(t.id())).addString(t.tenantCode()).addString(t.key())
                .addString(t.name()).addString(t.baseText()).addString(Pg.write(t.whatsapp()))
                .addString(Pg.write(t.email())).addOffsetDateTime(time(t.updatedAt())).addString(t.updatedBy())
                .addString(t.version()).addString(expectedVersion);
        return templates(query(pool.get(), UPSERT, params)).stream().findFirst();
    }

    private static List<ConvTemplate> templates(RowSet<Row> rows) {
        List<ConvTemplate> out = new ArrayList<>();
        rows.forEach(r -> out.add(new ConvTemplate(string(r, "id"), r.getString("tenant_code"), r.getString("key"),
                r.getString("name"), r.getString("base_text"),
                Pg.read(r.getString("whatsapp"), ConvTemplate.WhatsApp.class),
                Pg.read(r.getString("email"), ConvTemplate.Email.class), instant(r, "created_at"),
                instant(r, "updated_at"), r.getString("updated_by"), r.getString("version"))));
        return out;
    }
}

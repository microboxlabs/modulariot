package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.store.PgIds.parse;
import static com.microboxlabs.miot.symptoms.store.PgIds.query;
import static com.microboxlabs.miot.symptoms.store.PgIds.text;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.symptoms.catalog.store.PgJson;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link ContactStore} on the modulith database, schema {@code miot_symptoms}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgContactStore implements ContactStore {

    private static final TypeReference<List<CallMethod>> METHODS = new TypeReference<>() {
    };

    private static final String COLUMNS = """
            id, tenant_code, name, role, phone, methods, active, notes, created_by, created_at, updated_at""";

    private static final String SELECT = "SELECT " + COLUMNS + " FROM miot_symptoms.contact WHERE tenant_code = $1 ";

    private static final String INSERT = """
            INSERT INTO miot_symptoms.contact (""" + COLUMNS + """
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
            RETURNING\s""" + COLUMNS;

    private static final String UPDATE = """
            UPDATE miot_symptoms.contact
            SET name = $3, role = $4, phone = $5, methods = $6::jsonb, active = $7, notes = $8, updated_at = $9
            WHERE tenant_code = $1 AND id = $2
            RETURNING\s""" + COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgContactStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgContactStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Contact insert(Contact c) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Tuple params = Tuple.tuple()
                .addUUID(UUID.randomUUID()).addString(c.tenantCode()).addString(c.name()).addString(c.role())
                .addString(c.phone()).addString(PgJson.write(methods(c))).addBoolean(c.active())
                .addString(c.notes()).addString(c.createdBy()).addOffsetDateTime(now).addOffsetDateTime(now);
        return contacts(query(pool.get(), INSERT, params)).get(0);
    }

    @Override
    public Optional<Contact> update(Contact c) {
        UUID id = parse(c.id());
        if (id == null) {
            return Optional.empty();
        }
        Tuple params = Tuple.tuple()
                .addString(c.tenantCode()).addUUID(id).addString(c.name()).addString(c.role())
                .addString(c.phone()).addString(PgJson.write(methods(c))).addBoolean(c.active())
                .addString(c.notes()).addOffsetDateTime(OffsetDateTime.now(ZoneOffset.UTC));
        return contacts(query(pool.get(), UPDATE, params)).stream().findFirst();
    }

    @Override
    public Optional<Contact> find(String tenantCode, String id) {
        UUID uuid = parse(id);
        if (uuid == null) {
            return Optional.empty();
        }
        return contacts(query(pool.get(), SELECT + "AND id = $2", Tuple.of(tenantCode, uuid))).stream().findFirst();
    }

    @Override
    public List<Contact> list(String tenantCode, Boolean active) {
        if (active == null) {
            return contacts(query(pool.get(), SELECT + "ORDER BY created_at, id", Tuple.of(tenantCode)));
        }
        return contacts(query(pool.get(), SELECT + "AND active = $2 ORDER BY created_at, id",
                Tuple.of(tenantCode, active)));
    }

    @Override
    public boolean delete(String tenantCode, String id) {
        UUID uuid = parse(id);
        if (uuid == null) {
            return false;
        }
        return query(pool.get(), "DELETE FROM miot_symptoms.contact WHERE tenant_code = $1 AND id = $2",
                Tuple.of(tenantCode, uuid)).rowCount() > 0;
    }

    @Override
    public boolean isEmpty(String tenantCode) {
        return !query(pool.get(), "SELECT 1 FROM miot_symptoms.contact WHERE tenant_code = $1 LIMIT 1",
                Tuple.of(tenantCode)).iterator().hasNext();
    }

    private static List<CallMethod> methods(Contact c) {
        return c.methods() == null ? List.of() : c.methods();
    }

    private static List<Contact> contacts(RowSet<Row> rows) {
        List<Contact> out = new ArrayList<>();
        for (Row r : rows) {
            out.add(new Contact(
                    text(r.getUUID("id")), r.getString("tenant_code"), r.getString("name"), r.getString("role"),
                    r.getString("phone"), PgJson.read(r, "methods", METHODS), r.getBoolean("active"),
                    r.getString("notes"), r.getString("created_by"), PgJson.time(r, "created_at"),
                    PgJson.time(r, "updated_at")));
        }
        return out;
    }
}

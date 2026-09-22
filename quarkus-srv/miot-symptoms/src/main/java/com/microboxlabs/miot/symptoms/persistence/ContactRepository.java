package com.microboxlabs.miot.symptoms.persistence;

import static com.microboxlabs.miot.symptoms.persistence.RowMappers.stringList;
import static com.microboxlabs.miot.symptoms.persistence.RowMappers.toJsonArray;
import static com.microboxlabs.miot.symptoms.persistence.RowMappers.toUuid;
import static com.microboxlabs.miot.symptoms.persistence.RowMappers.uuid;

import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Tenant contact list in {@code miot_symptoms.contacts}. */
@ApplicationScoped
public class ContactRepository {

    private static final String COLUMNS =
            "id, tenant_code, name, role, phone, methods, active, notes, created_by, created_at, updated_at";

    private static final String INSERT = """
            INSERT INTO miot_symptoms.contacts (tenant_code, name, role, phone, methods, active, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING %s""".formatted(COLUMNS);

    private static final String UPDATE = """
            UPDATE miot_symptoms.contacts
            SET name = $3, role = $4, phone = $5, methods = $6, active = $7, notes = $8, updated_at = now()
            WHERE tenant_code = $1 AND id = $2
            RETURNING %s""".formatted(COLUMNS);

    private static final String FIND = """
            SELECT %s FROM miot_symptoms.contacts WHERE tenant_code = $1 AND id = $2""".formatted(COLUMNS);

    private static final String LIST = """
            SELECT %s FROM miot_symptoms.contacts
            WHERE tenant_code = $1 AND ($2::boolean IS NULL OR active = $2)
            ORDER BY name""".formatted(COLUMNS);

    private static final String DELETE = """
            DELETE FROM miot_symptoms.contacts WHERE tenant_code = $1 AND id = $2""";

    private final Instance<Pool> clientInstance;

    protected ContactRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public Contact insert(Contact c) {
        Tuple params = Tuple.tuple()
                .addString(c.tenantCode())
                .addString(c.name())
                .addString(c.role())
                .addString(c.phone())
                .addJsonArray(toJsonArray(c.methods()))
                .addBoolean(c.active())
                .addString(c.notes())
                .addString(c.createdBy());
        RowSet<Row> rows = client().preparedQuery(INSERT).execute(params).await().indefinitely();
        return rows.iterator().hasNext() ? map(rows.iterator().next()) : null;
    }

    public Optional<Contact> update(Contact c) {
        Tuple params = Tuple.tuple()
                .addString(c.tenantCode())
                .addUUID(toUuid(c.id()))
                .addString(c.name())
                .addString(c.role())
                .addString(c.phone())
                .addJsonArray(toJsonArray(c.methods()))
                .addBoolean(c.active())
                .addString(c.notes());
        RowSet<Row> rows = client().preparedQuery(UPDATE).execute(params).await().indefinitely();
        return rows.iterator().hasNext() ? Optional.of(map(rows.iterator().next())) : Optional.empty();
    }

    public Optional<Contact> findById(String tenantCode, String id) {
        UUID uuid = toUuid(id);
        if (uuid == null) {
            return Optional.empty();
        }
        RowSet<Row> rows = client().preparedQuery(FIND).execute(Tuple.of(tenantCode, uuid)).await().indefinitely();
        return rows.iterator().hasNext() ? Optional.of(map(rows.iterator().next())) : Optional.empty();
    }

    public List<Contact> list(String tenantCode, Boolean active) {
        RowSet<Row> rows = client().preparedQuery(LIST)
                .execute(Tuple.tuple().addString(tenantCode).addBoolean(active)).await().indefinitely();
        List<Contact> out = new ArrayList<>();
        rows.forEach(row -> out.add(map(row)));
        return out;
    }

    public boolean delete(String tenantCode, String id) {
        UUID uuid = toUuid(id);
        if (uuid == null) {
            return false;
        }
        return client().preparedQuery(DELETE).execute(Tuple.of(tenantCode, uuid)).await().indefinitely()
                .rowCount() > 0;
    }

    private Pool client() {
        return clientInstance.get();
    }

    private Contact map(Row row) {
        List<CallMethod> methods = new ArrayList<>();
        for (String m : stringList(row.getJsonArray("methods"))) {
            try {
                methods.add(CallMethod.valueOf(m));
            } catch (IllegalArgumentException ignored) {
                // an unknown channel stored by an older writer is dropped rather than failing the read
            }
        }
        return new Contact(
                uuid(row, "id"),
                row.getString("tenant_code"),
                row.getString("name"),
                row.getString("role"),
                row.getString("phone"),
                methods,
                Boolean.TRUE.equals(row.getBoolean("active")),
                row.getString("notes"),
                row.getString("created_by"),
                row.getOffsetDateTime("created_at"),
                row.getOffsetDateTime("updated_at"));
    }
}

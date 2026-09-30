package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.store.PgIds.parse;
import static com.microboxlabs.miot.symptoms.store.PgIds.query;
import static com.microboxlabs.miot.symptoms.store.PgIds.text;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.symptoms.catalog.store.PgJson;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
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
    private static final TypeReference<List<String>> TAGS = new TypeReference<>() {
    };
    private static final String UNIQUE_VIOLATION = "23505";

    private static final String COLUMNS = """
            id, tenant_code, name, role, phone, methods, active, notes, created_by, created_at, updated_at, \
            national_id, national_id_type, company, position, channels, tags, member_user_id, provisional""";

    private static final String SELECT = "SELECT " + COLUMNS + " FROM miot_symptoms.contact WHERE tenant_code = $1 ";

    // A duplicate national id inserts nothing and returns no row.
    private static final String INSERT = """
            INSERT INTO miot_symptoms.contact (""" + COLUMNS + """
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11,
                      $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18, $19)
            ON CONFLICT (tenant_code, national_id) WHERE national_id IS NOT NULL DO NOTHING
            RETURNING\s""" + COLUMNS;

    private static final String UPDATE = """
            UPDATE miot_symptoms.contact
            SET name = $3, role = $4, phone = $5, methods = $6::jsonb, active = $7, notes = $8, updated_at = $9,
                national_id = $10, national_id_type = $11, company = $12, position = $13, channels = $14::jsonb,
                tags = $15::jsonb, member_user_id = $16, provisional = $17
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
    public Contact insert(Contact contact) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Contact c = contact.stored(null, contact.createdBy(), now, now);
        Tuple params = Tuple.tuple()
                .addUUID(UUID.randomUUID()).addString(c.tenantCode()).addString(c.name()).addString(c.role())
                .addString(c.phone()).addString(PgJson.write(c.methods())).addBoolean(c.active())
                .addString(c.notes()).addString(c.createdBy()).addOffsetDateTime(now).addOffsetDateTime(now);
        addBookFields(params, c);
        List<Contact> saved = contacts(query(pool.get(), INSERT, params));
        if (saved.isEmpty()) {
            throw new DuplicateNationalIdException(c.nationalId());
        }
        return saved.get(0);
    }

    @Override
    public Optional<Contact> update(Contact contact) {
        UUID id = parse(contact.id());
        if (id == null) {
            return Optional.empty();
        }
        Contact c = contact.stored(contact.id(), contact.createdBy(), null, null);
        Tuple params = Tuple.tuple()
                .addString(c.tenantCode()).addUUID(id).addString(c.name()).addString(c.role())
                .addString(c.phone()).addString(PgJson.write(c.methods())).addBoolean(c.active())
                .addString(c.notes()).addOffsetDateTime(OffsetDateTime.now(ZoneOffset.UTC));
        addBookFields(params, c);
        try {
            return contacts(query(pool.get(), UPDATE, params)).stream().findFirst();
        } catch (PgException e) {
            if (UNIQUE_VIOLATION.equals(e.getSqlState())) {
                throw new DuplicateNationalIdException(c.nationalId());
            }
            throw e;
        }
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
    public Optional<Contact> findByNationalId(String tenantCode, String nationalId) {
        if (nationalId == null) {
            return Optional.empty();
        }
        return contacts(query(pool.get(), SELECT + "AND national_id = $2", Tuple.of(tenantCode, nationalId)))
                .stream().findFirst();
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

    private static void addBookFields(Tuple params, Contact c) {
        params.addString(c.nationalId()).addString(c.nationalIdType()).addString(c.company())
                .addString(c.position()).addString(PgJson.write(c.channels())).addString(PgJson.write(c.tags()))
                .addString(c.memberUserId()).addBoolean(c.provisional());
    }

    private static List<Contact> contacts(RowSet<Row> rows) {
        List<Contact> out = new ArrayList<>();
        for (Row r : rows) {
            out.add(new Contact(
                    text(r.getUUID("id")), r.getString("tenant_code"), r.getString("name"), r.getString("role"),
                    r.getString("phone"), PgJson.read(r, "methods", METHODS), r.getBoolean("active"),
                    r.getString("notes"), r.getString("created_by"), PgJson.time(r, "created_at"),
                    PgJson.time(r, "updated_at"), r.getString("national_id"), r.getString("national_id_type"),
                    r.getString("company"), r.getString("position"),
                    PgJson.read(r, "channels", ContactChannels.class), PgJson.read(r, "tags", TAGS),
                    r.getString("member_user_id"), r.getBoolean("provisional")));
        }
        return out;
    }
}

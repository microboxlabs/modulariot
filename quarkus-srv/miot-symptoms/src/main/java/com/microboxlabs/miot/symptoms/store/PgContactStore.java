package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.store.PgIds.parse;
import static com.microboxlabs.miot.symptoms.store.PgIds.query;
import static com.microboxlabs.miot.symptoms.store.PgIds.text;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.symptoms.catalog.store.PgJson;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.Contact;
import com.microboxlabs.miot.symptoms.domain.ContactChannels;
import com.microboxlabs.miot.symptoms.domain.ContactFacets;
import com.microboxlabs.miot.symptoms.domain.ContactFilter;
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
import java.util.Locale;
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
    private static final TypeReference<List<String>> NAMES = TAGS;
    private static final TypeReference<List<ContactFacets.Company>> COMPANIES = new TypeReference<>() {
    };
    private static final TypeReference<List<ContactFacets.Member>> MEMBERS = new TypeReference<>() {
    };
    private static final String UNIQUE_VIOLATION = "23505";
    private static final String MEMBER_INDEX = "uq_contact_member";
    // The JSON columns hold the JSON as a jsonb string; these read either that or plain jsonb.
    private static final String TAGS_JSON = "(CASE WHEN jsonb_typeof(tags) = 'string' THEN (tags #>> '{}')::jsonb "
            + "ELSE tags END)";
    private static final String EMAIL = "(CASE WHEN jsonb_typeof(channels) = 'string' "
            + "THEN (channels #>> '{}')::jsonb ELSE channels END ->> 'email')";

    private static final String COLUMNS = """
            id, tenant_code, name, role, phone, methods, active, notes, created_by, created_at, updated_at,
            national_id, national_id_type, company, position, channels, tags, member_user_id, provisional, company_rut,
            company_tax_id_type""";

    private static final String SELECT = "SELECT " + COLUMNS + " FROM miot_symptoms.contact WHERE tenant_code = $1 ";

    // A duplicate national id inserts nothing and returns no row.
    private static final String INSERT = "INSERT INTO miot_symptoms.contact (" + COLUMNS + """
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11,
                      $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18, $19, $20, $21)
            ON CONFLICT (tenant_code, national_id) WHERE national_id IS NOT NULL DO NOTHING
            RETURNING\s""" + COLUMNS;

    private static final String UPDATE = """
            UPDATE miot_symptoms.contact
            SET name = $3, role = $4, phone = $5, methods = $6::jsonb, active = $7, notes = $8, updated_at = $9,
                national_id = $10, national_id_type = $11, company = $12, position = $13, channels = $14::jsonb,
                tags = $15::jsonb, member_user_id = $16, provisional = $17, company_rut = $18,
                company_tax_id_type = $19
            WHERE tenant_code = $1 AND id = $2
            RETURNING\s""" + COLUMNS;

    // Each facet once ignoring case. A company keeps its oldest spelling and the oldest tax id given for it.
    private static final String FACETS = """
            WITH c AS (SELECT * FROM miot_symptoms.contact WHERE tenant_code = $1)
            SELECT
              (SELECT count(*) FROM c) AS total,
              (SELECT coalesce(jsonb_agg(v ORDER BY lower(v)), '[]'::jsonb) FROM (
                 SELECT DISTINCT ON (lower(trim(role))) trim(role) AS v FROM c
                 WHERE trim(role) <> '' ORDER BY lower(trim(role)), created_at) r) AS roles,
              (SELECT coalesce(jsonb_agg(jsonb_build_object('name', v, 'rut', rut, 'taxIdType', type)
                 ORDER BY lower(v)), '[]'::jsonb) FROM (
                 SELECT (array_agg(trim(company) ORDER BY created_at))[1] AS v,
                        (array_agg(company_rut ORDER BY created_at) FILTER (WHERE company_rut IS NOT NULL))[1] AS rut,
                        (array_agg(company_tax_id_type ORDER BY created_at)
                           FILTER (WHERE company_rut IS NOT NULL))[1] AS type
                 FROM c WHERE trim(company) <> '' GROUP BY lower(trim(company))) o) AS companies,
              (SELECT coalesce(jsonb_agg(v ORDER BY lower(v)), '[]'::jsonb) FROM (
                 SELECT DISTINCT ON (lower(trim(t))) trim(t) AS v
                 FROM c, jsonb_array_elements_text(CASE jsonb_typeof(c.tags)
                     WHEN 'array' THEN c.tags
                     WHEN 'string' THEN (c.tags #>> '{}')::jsonb
                     ELSE '[]'::jsonb END) t
                 WHERE trim(t) <> '' ORDER BY lower(trim(t))) g) AS tags,
              (SELECT coalesce(jsonb_agg(jsonb_build_object('memberUserId', member_user_id, 'contactId', id)),
                 '[]'::jsonb) FROM c WHERE member_user_id IS NOT NULL) AS members""";

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
        List<Contact> saved;
        try {
            saved = contacts(query(pool.get(), INSERT, params));
        } catch (PgException e) {
            throw conflict(e, c);
        }
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
            throw conflict(e, c);
        }
    }

    private static RuntimeException conflict(PgException e, Contact c) {
        if (!UNIQUE_VIOLATION.equals(e.getSqlState())) {
            return e;
        }
        return MEMBER_INDEX.equals(e.getConstraint())
                ? new DuplicateMemberException()
                : new DuplicateNationalIdException(c.nationalId());
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
    public Optional<Contact> findByMember(String tenantCode, String memberUserId) {
        if (memberUserId == null) {
            return Optional.empty();
        }
        return contacts(query(pool.get(), SELECT + "AND member_user_id = $2", Tuple.of(tenantCode, memberUserId)))
                .stream().findFirst();
    }

    @Override
    public List<Contact> page(String tenantCode, ContactFilter filter, After after, int limit) {
        List<Object> params = new ArrayList<>(List.of(tenantCode));
        StringBuilder sql = new StringBuilder(SELECT);
        ContactFilter f = filter == null ? ContactFilter.ALL : filter;
        if (f.text() != null) {
            params.add("%" + likeEscaped(f.text().toLowerCase(Locale.ROOT)) + "%");
            String p = "$" + params.size();
            sql.append("AND (lower(name) LIKE ").append(p).append(" OR lower(role) LIKE ").append(p)
                    .append(" OR lower(company) LIKE ").append(p).append(" OR lower(").append(EMAIL).append(") LIKE ")
                    .append(p);
            String id = f.text().replaceAll("[.\\-\\s]", "").toUpperCase(Locale.ROOT);
            if (!id.isEmpty()) {
                params.add("%" + likeEscaped(id) + "%");
                sql.append(" OR national_id LIKE $").append(params.size());
            }
            sql.append(") ");
        }
        if (f.member() != null) {
            sql.append(Boolean.TRUE.equals(f.member()) ? "AND member_user_id IS NOT NULL "
                    : "AND member_user_id IS NULL ");
        }
        if (f.role() != null) {
            params.add(f.role());
            sql.append("AND lower(trim(role)) = lower($").append(params.size()).append(") ");
        }
        if (f.company() != null) {
            params.add(f.company());
            sql.append("AND lower(trim(company)) = lower($").append(params.size()).append(") ");
        }
        if (f.tag() != null) {
            params.add(f.tag());
            sql.append("AND jsonb_typeof(").append(TAGS_JSON).append(") = 'array' AND EXISTS (SELECT 1 FROM ")
                    .append("jsonb_array_elements_text(").append(TAGS_JSON).append(") t ")
                    .append("WHERE lower(trim(t)) = lower($").append(params.size()).append(")) ");
        }
        if (f.active() != null) {
            params.add(f.active());
            sql.append("AND active = $").append(params.size()).append(' ');
        }
        UUID afterId = after == null ? null : parse(after.id());
        if (afterId != null) {
            params.add(after.createdAt());
            params.add(afterId);
            sql.append("AND (created_at, id) > ($").append(params.size() - 1).append(", $").append(params.size())
                    .append(") ");
        }
        params.add(limit);
        sql.append("ORDER BY created_at, id LIMIT $").append(params.size());
        return contacts(query(pool.get(), sql.toString(), Tuple.from(params)));
    }

    /** {@code %}, {@code _} and the backslash match themselves. */
    private static String likeEscaped(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    @Override
    public ContactFacets facets(String tenantCode) {
        Row r = query(pool.get(), FACETS, Tuple.of(tenantCode)).iterator().next();
        return new ContactFacets(r.getLong("total"), PgJson.read(r, "roles", NAMES),
                PgJson.read(r, "companies", COMPANIES), PgJson.read(r, "tags", NAMES),
                PgJson.read(r, "members", MEMBERS));
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
                .addString(c.memberUserId()).addBoolean(c.provisional()).addString(c.companyRut())
                .addString(c.companyTaxIdType());
    }

    private static List<Contact> contacts(RowSet<Row> rows) {
        return rows.stream().map(PgContactStore::contact).toList();
    }

    private static Contact contact(Row r) {
        return new Contact(
                text(r.getUUID("id")), r.getString("tenant_code"), r.getString("name"), r.getString("role"),
                r.getString("phone"), PgJson.read(r, "methods", METHODS), r.getBoolean("active"),
                r.getString("notes"), r.getString("created_by"), PgJson.time(r, "created_at"),
                PgJson.time(r, "updated_at"), r.getString("national_id"), r.getString("national_id_type"),
                r.getString("company"), r.getString("position"),
                PgJson.read(r, "channels", ContactChannels.class), PgJson.read(r, "tags", TAGS),
                r.getString("member_user_id"), r.getBoolean("provisional"), r.getString("company_rut"),
                r.getString("company_tax_id_type"));
    }
}

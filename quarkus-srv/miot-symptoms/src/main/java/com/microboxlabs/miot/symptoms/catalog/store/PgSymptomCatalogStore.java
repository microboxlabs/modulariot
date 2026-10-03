package com.microboxlabs.miot.symptoms.catalog.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomDefinition;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomVersion;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionBump;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionStatus;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.SqlClient;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/** {@link SymptomCatalogStore} on the modulith database, schema {@code miot_symptoms}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgSymptomCatalogStore implements SymptomCatalogStore {

    private static final String UNIQUE_VIOLATION = "23505";

    private static final String DEFINITION_COLUMNS = """
            id, tenant_code, symptom_key, name, family, icon, description, source_key, engine_rule_id,
            template_key, forked_from_version_id, state, current_version, created_by, created_at,
            updated_by, updated_at""";

    private static final String SELECT_DEFINITIONS = "SELECT " + DEFINITION_COLUMNS
            + " FROM miot_symptoms.symptom_definition WHERE tenant_code = $1 ";

    private static final String INSERT_DEFINITION = "INSERT INTO miot_symptoms.symptom_definition ("
            + DEFINITION_COLUMNS + """
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING\s""" + DEFINITION_COLUMNS;

    private static final String UPDATE_DEFINITION = """
            UPDATE miot_symptoms.symptom_definition
            SET name = $3, family = $4, icon = $5, description = $6, source_key = $7, engine_rule_id = $8,
                state = $9, current_version = $10, updated_by = $11, updated_at = $12
            WHERE tenant_code = $1 AND id = $2
            RETURNING\s""" + DEFINITION_COLUMNS;

    private static final String VERSION_COLUMNS = """
            id, definition_id, tenant_code, version, status, spec, bump, reason, rolled_back_from,
            created_by, created_at, published_by, published_at""";

    private static final String SELECT_VERSIONS = "SELECT " + VERSION_COLUMNS
            + " FROM miot_symptoms.symptom_version WHERE tenant_code = $1 AND definition_id = $2 ";

    private static final String UPSERT_DRAFT = """
            INSERT INTO miot_symptoms.symptom_version (
                id, definition_id, tenant_code, status, spec, created_by, created_at
            ) VALUES ($1, $2, $3, 'DRAFT', $4::jsonb, $5, $6)
            ON CONFLICT (definition_id) WHERE status = 'DRAFT'
            DO UPDATE SET spec = EXCLUDED.spec
            WHERE miot_symptoms.symptom_version.tenant_code = EXCLUDED.tenant_code
            RETURNING\s""" + VERSION_COLUMNS;

    private static final String DRAFT_IDS = """
            SELECT definition_id FROM miot_symptoms.symptom_version
            WHERE tenant_code = $1 AND status = 'DRAFT'""";

    private static final String CURRENT_VERSIONS = """
            SELECT v.id, v.definition_id, v.tenant_code, v.version, v.status, v.spec, v.bump, v.reason,
                   v.rolled_back_from, v.created_by, v.created_at, v.published_by, v.published_at
            FROM miot_symptoms.symptom_version v
            JOIN miot_symptoms.symptom_definition d
              ON d.id = v.definition_id AND d.tenant_code = v.tenant_code AND d.current_version = v.version
            WHERE v.tenant_code = $1 AND v.status = 'PUBLISHED'""";

    private static final String DELETE_DRAFT = """
            DELETE FROM miot_symptoms.symptom_version
            WHERE tenant_code = $1 AND definition_id = $2 AND status = 'DRAFT'""";

    private static final String UPSERT_PUBLISHED = "INSERT INTO miot_symptoms.symptom_version ("
            + VERSION_COLUMNS + """
            ) VALUES ($1, $2, $3, $4, 'PUBLISHED', $5::jsonb, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
                version = EXCLUDED.version, status = 'PUBLISHED', spec = EXCLUDED.spec, bump = EXCLUDED.bump,
                reason = EXCLUDED.reason, rolled_back_from = EXCLUDED.rolled_back_from,
                published_by = EXCLUDED.published_by, published_at = EXCLUDED.published_at
            WHERE miot_symptoms.symptom_version.status = 'DRAFT'
              AND miot_symptoms.symptom_version.tenant_code = EXCLUDED.tenant_code
            RETURNING\s""" + VERSION_COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgSymptomCatalogStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgSymptomCatalogStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<SymptomDefinition> listDefinitions(String tenantCode) {
        return definitions(query(pool.get(), SELECT_DEFINITIONS + "ORDER BY name", Tuple.of(tenantCode)));
    }

    @Override
    public Optional<SymptomDefinition> findDefinition(String tenantCode, UUID id) {
        return definitions(query(pool.get(), SELECT_DEFINITIONS + "AND id = $2", Tuple.of(tenantCode, id)))
                .stream().findFirst();
    }

    @Override
    public Optional<SymptomDefinition> findDefinitionByKey(String tenantCode, String key) {
        return definitions(query(pool.get(), SELECT_DEFINITIONS + "AND symptom_key = $2", Tuple.of(tenantCode, key)))
                .stream().findFirst();
    }

    @Override
    public SymptomDefinition insertDefinition(SymptomDefinition d) {
        Tuple params = Tuple.tuple()
                .addUUID(d.id()).addString(d.tenantCode()).addString(d.key()).addString(d.name())
                .addString(d.family()).addString(d.icon()).addString(d.description()).addString(d.sourceKey())
                .addInteger(d.engineRuleId()).addString(d.templateKey()).addUUID(d.forkedFromVersionId())
                .addString(d.state().name()).addString(d.currentVersion())
                .addString(d.createdBy()).addOffsetDateTime(d.createdAt())
                .addString(d.updatedBy()).addOffsetDateTime(d.updatedAt());
        try {
            return definitions(query(pool.get(), INSERT_DEFINITION, params)).get(0);
        } catch (PgException e) {
            if (UNIQUE_VIOLATION.equals(e.getSqlState())) {
                throw new DuplicateSymptomKeyException(d.key());
            }
            throw e;
        }
    }

    @Override
    public SymptomDefinition updateDefinition(SymptomDefinition d) {
        return updateDefinition(pool.get(), d);
    }

    @Override
    public List<SymptomVersion> listVersions(String tenantCode, UUID definitionId) {
        return versions(query(pool.get(), SELECT_VERSIONS + "ORDER BY created_at DESC",
                Tuple.of(tenantCode, definitionId)));
    }

    @Override
    public Optional<SymptomVersion> findDraft(String tenantCode, UUID definitionId) {
        return versions(query(pool.get(), SELECT_VERSIONS + "AND status = 'DRAFT'",
                Tuple.of(tenantCode, definitionId))).stream().findFirst();
    }

    @Override
    public Optional<SymptomVersion> findVersion(String tenantCode, UUID definitionId, String version) {
        return versions(query(pool.get(), SELECT_VERSIONS + "AND version = $3",
                Tuple.of(tenantCode, definitionId, version))).stream().findFirst();
    }

    @Override
    public Optional<SymptomVersion> findVersionById(String tenantCode, UUID versionId) {
        return versions(query(pool.get(), "SELECT " + VERSION_COLUMNS
                + " FROM miot_symptoms.symptom_version WHERE tenant_code = $1 AND id = $2",
                Tuple.of(tenantCode, versionId))).stream().findFirst();
    }

    @Override
    public SymptomVersion saveDraft(SymptomVersion v) {
        Tuple params = Tuple.tuple()
                .addUUID(v.id()).addUUID(v.definitionId()).addString(v.tenantCode())
                .addString(PgJson.write(v.spec())).addString(v.createdBy()).addOffsetDateTime(v.createdAt());
        List<SymptomVersion> saved = versions(query(pool.get(), UPSERT_DRAFT, params));
        if (saved.isEmpty()) {
            throw new NoSuchElementException("Symptom not found: " + v.definitionId());
        }
        return saved.get(0);
    }

    @Override
    public Set<UUID> definitionsWithDraft(String tenantCode) {
        return query(pool.get(), DRAFT_IDS, Tuple.of(tenantCode)).stream()
                .map(r -> r.getUUID("definition_id"))
                .collect(Collectors.toSet());
    }

    @Override
    public List<SymptomVersion> currentVersions(String tenantCode) {
        return versions(query(pool.get(), CURRENT_VERSIONS, Tuple.of(tenantCode)));
    }

    @Override
    public void deleteDraft(String tenantCode, UUID definitionId) {
        query(pool.get(), DELETE_DRAFT, Tuple.of(tenantCode, definitionId));
    }

    @Override
    public SymptomVersion publish(SymptomVersion v, SymptomDefinition definition) {
        Tuple params = Tuple.tuple()
                .addUUID(v.id()).addUUID(v.definitionId()).addString(v.tenantCode()).addString(v.version())
                .addString(PgJson.write(v.spec())).addString(v.bump() == null ? null : v.bump().name())
                .addString(v.reason()).addString(v.rolledBackFrom())
                .addString(v.createdBy()).addOffsetDateTime(v.createdAt())
                .addString(v.publishedBy()).addOffsetDateTime(v.publishedAt());
        // A published row is never rewritten: the upsert only takes over a draft, so no row back means the
        // version was published already (or by someone else first) and the transaction rolls back.
        return pool.get().withTransaction(tx -> tx.preparedQuery(UPSERT_PUBLISHED).execute(params)
                        .map(rows -> {
                            if (rows.rowCount() == 0) {
                                throw new IllegalStateException("version already published: " + v.id());
                            }
                            return versions(rows).get(0);
                        })
                        .flatMap(saved -> tx.preparedQuery(UPDATE_DEFINITION).execute(definitionParams(definition))
                                .map(rows -> {
                                    if (rows.rowCount() == 0) {
                                        throw new NoSuchElementException("Symptom not found: " + definition.id());
                                    }
                                    return saved;
                                })))
                .await().atMost(QUERY_TIMEOUT);
    }

    private static SymptomDefinition updateDefinition(SqlClient client, SymptomDefinition d) {
        List<SymptomDefinition> updated = definitions(query(client, UPDATE_DEFINITION, definitionParams(d)));
        if (updated.isEmpty()) {
            throw new NoSuchElementException("Symptom not found: " + d.id());
        }
        return updated.get(0);
    }

    private static Tuple definitionParams(SymptomDefinition d) {
        return Tuple.tuple()
                .addString(d.tenantCode()).addUUID(d.id()).addString(d.name()).addString(d.family())
                .addString(d.icon()).addString(d.description()).addString(d.sourceKey())
                .addInteger(d.engineRuleId()).addString(d.state().name()).addString(d.currentVersion())
                .addString(d.updatedBy()).addOffsetDateTime(d.updatedAt());
    }

    private static RowSet<Row> query(SqlClient client, String sql, Tuple params) {
        return client.preparedQuery(sql).execute(params).await().atMost(QUERY_TIMEOUT);
    }

    private static List<SymptomDefinition> definitions(RowSet<Row> rows) {
        return rows.stream().map(r -> new SymptomDefinition(
                r.getUUID("id"), r.getString("tenant_code"), r.getString("symptom_key"), r.getString("name"),
                r.getString("family"), r.getString("icon"), r.getString("description"),
                r.getString("source_key"), r.getInteger("engine_rule_id"), r.getString("template_key"),
                r.getUUID("forked_from_version_id"), SymptomState.valueOf(r.getString("state")),
                r.getString("current_version"), r.getString("created_by"), PgJson.time(r, "created_at"),
                r.getString("updated_by"), PgJson.time(r, "updated_at"))).toList();
    }

    private static List<SymptomVersion> versions(RowSet<Row> rows) {
        List<SymptomVersion> out = new ArrayList<>();
        for (Row r : rows) {
            String bump = r.getString("bump");
            out.add(new SymptomVersion(
                    r.getUUID("id"), r.getUUID("definition_id"), r.getString("tenant_code"), r.getString("version"),
                    VersionStatus.valueOf(r.getString("status")), PgJson.read(r, "spec", SymptomSpec.class),
                    bump == null ? null : VersionBump.valueOf(bump), r.getString("reason"),
                    r.getString("rolled_back_from"), r.getString("created_by"), PgJson.time(r, "created_at"),
                    r.getString("published_by"), PgJson.time(r, "published_at")));
        }
        return out;
    }
}

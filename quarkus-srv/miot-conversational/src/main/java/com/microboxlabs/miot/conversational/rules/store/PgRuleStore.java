package com.microboxlabs.miot.conversational.rules.store;

import static com.microboxlabs.miot.conversational.rules.store.Pg.SELECT;
import static com.microboxlabs.miot.conversational.rules.store.Pg.instant;
import static com.microboxlabs.miot.conversational.rules.store.Pg.query;
import static com.microboxlabs.miot.conversational.rules.store.Pg.string;
import static com.microboxlabs.miot.conversational.rules.store.Pg.time;
import static com.microboxlabs.miot.conversational.rules.store.Pg.uuid;
import static com.microboxlabs.miot.conversational.rules.store.Pg.uuidOrNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.rules.Rule;
import com.microboxlabs.miot.conversational.rules.RuleBump;
import com.microboxlabs.miot.conversational.rules.RuleVersion;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link RuleStore} on {@code miot_conversational.conv_rule} and {@code conv_rule_version}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class PgRuleStore implements RuleStore {

    private static final String RULE_COLUMNS =
            "id, tenant_code, key, name, state, current_version, created_at, updated_at";
    private static final String VERSION_COLUMNS =
            "id, rule_id, version, bump, status, spec::text AS spec, reason, created_at, created_by";

    private static final String LIST = SELECT + RULE_COLUMNS
            + " FROM miot_conversational.conv_rule WHERE tenant_code = $1 ORDER BY name, key";
    private static final String LIST_ALL = SELECT + RULE_COLUMNS
            + " FROM miot_conversational.conv_rule ORDER BY tenant_code, name, key";
    private static final String FIND = SELECT + RULE_COLUMNS
            + " FROM miot_conversational.conv_rule WHERE tenant_code = $1 AND id = $2";
    private static final String INSERT = "INSERT INTO miot_conversational.conv_rule (" + RULE_COLUMNS + """
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (tenant_code, key) DO NOTHING
            RETURNING\s""" + RULE_COLUMNS;
    private static final String UPDATE_STATE = """
            UPDATE miot_conversational.conv_rule SET state = $3, updated_at = $4
            WHERE tenant_code = $1 AND id = $2
            RETURNING\s""" + RULE_COLUMNS;
    private static final String VERSIONS = SELECT + VERSION_COLUMNS + """
             FROM miot_conversational.conv_rule_version WHERE rule_id = $1
            ORDER BY version IS NOT NULL, created_at DESC
            """;
    private static final String VERSION = SELECT + VERSION_COLUMNS
            + " FROM miot_conversational.conv_rule_version WHERE rule_id = $1 AND version = $2";
    private static final String LIVE_VERSIONS = """
            SELECT v.id, v.rule_id, v.version, v.bump, v.status, v.spec::text AS spec, v.reason, v.created_at,
                   v.created_by
            FROM miot_conversational.conv_rule_version v
            JOIN miot_conversational.conv_rule r ON r.id = v.rule_id
            WHERE v.rule_id = ANY($1::uuid[]) AND (v.status = 'DRAFT' OR v.version = r.current_version)
            """;
    private static final String DISCARD_DRAFT = """
            DELETE FROM miot_conversational.conv_rule_version WHERE rule_id = $1 AND status = 'DRAFT' RETURNING id
            """;
    private static final String SAVE_DRAFT = """
            INSERT INTO miot_conversational.conv_rule_version (id, rule_id, version, status, spec, created_at, created_by)
            VALUES ($1, $2, NULL, 'DRAFT', $3::text::jsonb, $4, $5)
            ON CONFLICT (rule_id) WHERE status = 'DRAFT'
            DO UPDATE SET spec = EXCLUDED.spec, created_at = EXCLUDED.created_at, created_by = EXCLUDED.created_by
            RETURNING\s""" + VERSION_COLUMNS;
    // One statement: the draft becomes version $6 and the rule points at it, only while its spec is the one that
    // was validated ($5) and the rule is still on the version $6 was computed from ($8), so a draft saved
    // meanwhile is never published unchecked and a concurrent publish never moves the version backwards.
    private static final String PUBLISH = """
            WITH v AS (
                UPDATE miot_conversational.conv_rule_version
                SET status = 'PUBLISHED', version = $6, bump = $7,
                    reason = $2, created_by = $3, created_at = $4
                WHERE rule_id = $1 AND status = 'DRAFT' AND spec = $5::text::jsonb
                  AND EXISTS (SELECT 1 FROM miot_conversational.conv_rule
                              WHERE id = $1 AND current_version IS NOT DISTINCT FROM $8::varchar)
                RETURNING *
            ), r AS (
                UPDATE miot_conversational.conv_rule
                SET current_version = (SELECT version FROM v), updated_at = $4
                WHERE id = $1 AND EXISTS (SELECT 1 FROM v)
            )
            SELECT\s""" + VERSION_COLUMNS + " FROM v";
    private static final String IN_FORCE = """
            SELECT r.id, r.tenant_code, r.key, r.name, r.state, r.current_version, r.created_at, r.updated_at,
                   v.id AS v_id, v.rule_id AS v_rule_id, v.version AS v_version, v.bump AS v_bump,
                   v.status AS v_status,
                   v.spec::text AS v_spec, v.reason AS v_reason, v.created_at AS v_created_at,
                   v.created_by AS v_created_by
            FROM miot_conversational.conv_rule r
            JOIN miot_conversational.conv_rule_version v
              ON v.rule_id = r.id AND v.version = r.current_version
            WHERE r.tenant_code = $1 AND r.state IN ('TEST', 'ACTIVE')
            """;

    private final Supplier<Pool> pool;

    @Inject
    PgRuleStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgRuleStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<Rule> list(String tenantCode) {
        return rules(query(pool.get(), LIST, Tuple.of(tenantCode)));
    }

    @Override
    public List<Rule> listAll() {
        return rules(query(pool.get(), LIST_ALL, Tuple.tuple()));
    }

    @Override
    public Optional<Rule> find(String tenantCode, String id) {
        UUID ruleId = uuidOrNull(id);
        if (ruleId == null) {
            return Optional.empty();
        }
        return rules(query(pool.get(), FIND, Tuple.of(tenantCode, ruleId))).stream().findFirst();
    }

    @Override
    public Rule create(Rule rule) {
        Tuple params = Tuple.tuple().addUUID(uuid(rule.id())).addString(rule.tenantCode()).addString(rule.key())
                .addString(rule.name()).addString(rule.state().name()).addString(rule.currentVersion())
                .addOffsetDateTime(time(rule.createdAt())).addOffsetDateTime(time(rule.updatedAt()));
        List<Rule> saved = rules(query(pool.get(), INSERT, params));
        if (saved.isEmpty()) {
            throw new IllegalStateException("Ya existe una regla con la clave " + rule.key());
        }
        return saved.get(0);
    }

    @Override
    public Optional<Rule> updateState(String tenantCode, String id, Rule.State state, Instant at) {
        UUID ruleId = uuidOrNull(id);
        if (ruleId == null) {
            return Optional.empty();
        }
        return rules(query(pool.get(), UPDATE_STATE, Tuple.of(tenantCode, ruleId, state.name(), time(at))))
                .stream().findFirst();
    }

    @Override
    public List<RuleVersion> versions(String ruleId) {
        return versions(query(pool.get(), VERSIONS, Tuple.of(uuid(ruleId))), "");
    }

    @Override
    public Optional<RuleVersion> version(String ruleId, String version) {
        return versions(query(pool.get(), VERSION, Tuple.of(uuid(ruleId), version)), "").stream().findFirst();
    }

    @Override
    public List<RuleVersion> liveVersions(List<String> ruleIds) {
        if (ruleIds.isEmpty()) {
            return List.of();
        }
        UUID[] ids = ruleIds.stream().map(Pg::uuid).toArray(UUID[]::new);
        return versions(query(pool.get(), LIVE_VERSIONS, Tuple.tuple().addArrayOfUUID(ids)), "");
    }

    @Override
    public RuleVersion saveDraft(String ruleId, JsonNode spec, String actor, Instant at) {
        Tuple params = Tuple.of(UUID.randomUUID(), uuid(ruleId), Pg.write(spec), time(at), actor);
        return versions(query(pool.get(), SAVE_DRAFT, params), "").get(0);
    }

    @Override
    public boolean discardDraft(String ruleId) {
        return query(pool.get(), DISCARD_DRAFT, Tuple.of(uuid(ruleId))).rowCount() > 0;
    }

    @Override
    public Optional<RuleVersion> publish(String ruleId, JsonNode validated, Publication p) {
        Tuple params = Tuple.tuple().addUUID(uuid(ruleId)).addString(p.reason()).addString(p.actor())
                .addOffsetDateTime(time(p.at())).addString(Pg.write(validated)).addString(p.version())
                .addString(p.bump().name()).addString(p.from());
        return versions(query(pool.get(), PUBLISH, params), "").stream().findFirst();
    }

    @Override
    public List<InForce> inForce(String tenantCode) {
        List<InForce> out = new ArrayList<>();
        for (Row row : query(pool.get(), IN_FORCE, Tuple.of(tenantCode))) {
            out.add(new InForce(rule(row), version(row, "v_")));
        }
        return out;
    }

    private static List<Rule> rules(RowSet<Row> rows) {
        List<Rule> out = new ArrayList<>();
        rows.forEach(r -> out.add(rule(r)));
        return out;
    }

    private static Rule rule(Row r) {
        return new Rule(string(r, "id"), r.getString("tenant_code"), r.getString("key"), r.getString("name"),
                Rule.State.valueOf(r.getString("state")), r.getString("current_version"), instant(r, "created_at"),
                instant(r, "updated_at"));
    }

    private static List<RuleVersion> versions(RowSet<Row> rows, String prefix) {
        List<RuleVersion> out = new ArrayList<>();
        rows.forEach(r -> out.add(version(r, prefix)));
        return out;
    }

    private static RuleVersion version(Row r, String p) {
        String bump = r.getString(p + "bump");
        return new RuleVersion(string(r, p + "id"), string(r, p + "rule_id"), r.getString(p + "version"),
                bump == null ? null : RuleBump.valueOf(bump),
                RuleVersion.Status.valueOf(r.getString(p + "status")), Pg.node(r.getString(p + "spec")),
                r.getString(p + "reason"), instant(r, p + "created_at"), r.getString(p + "created_by"));
    }
}

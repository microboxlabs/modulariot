package com.microboxlabs.miot.conversational.rules.store;

import static com.microboxlabs.miot.conversational.rules.store.Pg.SELECT;
import static com.microboxlabs.miot.conversational.rules.store.Pg.instant;
import static com.microboxlabs.miot.conversational.rules.store.Pg.query;
import static com.microboxlabs.miot.conversational.rules.store.Pg.string;
import static com.microboxlabs.miot.conversational.rules.store.Pg.time;
import static com.microboxlabs.miot.conversational.rules.store.Pg.uuid;
import static com.microboxlabs.miot.conversational.rules.store.Pg.uuidOrNull;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.conversational.rules.Invocation;
import com.microboxlabs.miot.conversational.rules.Run;
import com.microboxlabs.miot.conversational.rules.StoredEvent;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link RunStore} on {@code miot_conversational.conv_event}, {@code conv_run} and {@code wa_message}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class PgRunStore implements RunStore {

    private static final String EVENT_COLUMNS =
            "id, tenant_code, type, source, context_kind, context_key, data::text AS data, test, at, received_at";
    private static final String INSERT_EVENT = """
            INSERT INTO miot_conversational.conv_event
                (id, tenant_code, type, source, context_kind, context_key, data, test, at, received_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7::text::jsonb, $8, $9, $10)
            RETURNING\s""" + EVENT_COLUMNS;
    private static final String EVENT = SELECT + EVENT_COLUMNS
            + " FROM miot_conversational.conv_event WHERE id = $1";

    private static final TypeReference<Map<String, List<Invocation.Person>>> RECIPIENTS = new TypeReference<>() {
    };
    private static final String RUN_COLUMNS = """
            id, tenant_code, rule_id, rule_version, event_id, context_kind, context_key, test, status, step,
            next_at, last_error, created_at, updated_at, recipients::text AS recipients, invocation_key""";
    // A second invocation with the same key inserts nothing; the run it started is read instead.
    private static final String INSERT_RUN = """
            INSERT INTO miot_conversational.conv_run (
                id, tenant_code, rule_id, rule_version, event_id, context_kind, context_key, test, status, step,
                next_at, last_error, created_at, updated_at, recipients, invocation_key
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::text::jsonb, $16)
            ON CONFLICT (rule_id, invocation_key) WHERE invocation_key IS NOT NULL DO NOTHING
            RETURNING\s""" + RUN_COLUMNS;
    private static final String RUN = SELECT + RUN_COLUMNS + " FROM miot_conversational.conv_run WHERE id = $1";
    private static final String INVOKED = SELECT + RUN_COLUMNS
            + " FROM miot_conversational.conv_run WHERE rule_id = $1 AND invocation_key = $2";
    // SKIP LOCKED leaves runs another pod is claiming; the lease keeps them off later scans while they are worked.
    private static final String CLAIM = """
            UPDATE miot_conversational.conv_run SET next_at = $2, updated_at = $1
            WHERE id IN (
                SELECT id FROM miot_conversational.conv_run
                WHERE status = 'WAITING' AND next_at <= $1
                ORDER BY next_at
                LIMIT $3
                FOR UPDATE SKIP LOCKED)
            RETURNING\s""" + RUN_COLUMNS;
    private static final String UPDATE_IF_WAITING = """
            UPDATE miot_conversational.conv_run
            SET status = $2, step = $3, next_at = $4, last_error = $5, updated_at = $6
            WHERE id = $1 AND status = 'WAITING'
            """;
    private static final String WAITING = SELECT + RUN_COLUMNS + """
             FROM miot_conversational.conv_run
            WHERE tenant_code = $1 AND context_kind = $2 AND context_key = $3 AND status = 'WAITING'
            """;
    private static final String WAITING_ON_CONVERSATION = SELECT + RUN_COLUMNS + """
             FROM miot_conversational.conv_run r
            WHERE r.tenant_code = $1 AND r.status = 'WAITING' AND NOT r.test
              AND EXISTS (SELECT 1 FROM miot_conversational.wa_message m
                          WHERE m.run_id = r.id AND m.conversation_id = $2
                            AND m.status NOT IN ('SIMULATED', 'FAILED'))
            ORDER BY r.created_at DESC
            LIMIT 1
            """;
    private static final String LIST = """
            SELECT r.id, r.tenant_code, r.rule_id, r.rule_version, r.event_id, r.context_kind, r.context_key, r.test,
                   r.status, r.step, r.next_at, r.last_error, r.created_at, r.updated_at,
                   r.recipients::text AS recipients, r.invocation_key,
                   rule.name AS rule_name, e.type AS event_type,
                   e.data ->> 'symptomName' AS symptom_name, e.data ->> 'assetId' AS asset_id
            FROM miot_conversational.conv_run r
            JOIN miot_conversational.conv_rule rule ON rule.id = r.rule_id
            JOIN miot_conversational.conv_event e ON e.id = r.event_id
            WHERE r.tenant_code = $1
              AND ($2::uuid IS NULL OR r.rule_id = $2)
              AND ($3::text IS NULL OR r.status = $3)
            ORDER BY r.created_at DESC
            LIMIT $4
            """;
    private static final String MESSAGES = """
            SELECT m.id, m.run_id, m.step, m.channel, m.address, c.display_name, m.status, m.body, m.created_at
            FROM miot_conversational.wa_message m
            JOIN miot_conversational.wa_conversation c ON c.id = m.conversation_id
            WHERE m.run_id = ANY($1)
            ORDER BY m.created_at, m.id
            """;

    private final Supplier<Pool> pool;

    @Inject
    PgRunStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgRunStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public StoredEvent saveEvent(StoredEvent e) {
        Tuple params = Tuple.tuple().addUUID(uuid(e.id())).addString(e.tenantCode()).addString(e.type())
                .addString(e.source()).addString(e.contextKind()).addString(e.contextKey())
                .addString(Pg.write(e.data())).addBoolean(e.test()).addOffsetDateTime(time(e.at()))
                .addOffsetDateTime(time(e.receivedAt()));
        return event(query(pool.get(), INSERT_EVENT, params).iterator().next());
    }

    @Override
    public Optional<StoredEvent> event(String id) {
        UUID eventId = uuidOrNull(id);
        if (eventId == null) {
            return Optional.empty();
        }
        var rows = query(pool.get(), EVENT, Tuple.of(eventId)).iterator();
        return rows.hasNext() ? Optional.of(event(rows.next())) : Optional.empty();
    }

    @Override
    public Run createRun(Run r) {
        Tuple params = Tuple.tuple().addUUID(uuid(r.id())).addString(r.tenantCode()).addUUID(uuid(r.ruleId()))
                .addString(r.ruleVersion()).addUUID(uuid(r.eventId())).addString(r.contextKind())
                .addString(r.contextKey()).addBoolean(r.test()).addString(r.status().name()).addInteger(r.step())
                .addOffsetDateTime(time(r.nextAt())).addString(r.lastError()).addOffsetDateTime(time(r.createdAt()))
                .addOffsetDateTime(time(r.updatedAt()))
                .addString(r.recipients() == null ? null : Pg.write(r.recipients())).addString(r.invocationKey());
        List<Run> created = runs(query(pool.get(), INSERT_RUN, params));
        if (!created.isEmpty()) {
            return created.get(0);
        }
        return invoked(r.ruleId(), r.invocationKey()).orElseThrow();
    }

    @Override
    public Optional<Run> invoked(String ruleId, String key) {
        UUID rule = uuidOrNull(ruleId);
        if (rule == null || key == null) {
            return Optional.empty();
        }
        return runs(query(pool.get(), INVOKED, Tuple.of(rule, key))).stream().findFirst();
    }

    @Override
    public Optional<Run> find(String id) {
        UUID runId = uuidOrNull(id);
        if (runId == null) {
            return Optional.empty();
        }
        return runs(query(pool.get(), RUN, Tuple.of(runId))).stream().findFirst();
    }

    @Override
    public List<Run> claimDue(Instant now, Duration lease, int limit) {
        return runs(query(pool.get(), CLAIM, Tuple.of(time(now), time(now.plus(lease)), limit)));
    }

    @Override
    public boolean updateIfWaiting(Run r) {
        Tuple params = Tuple.tuple().addUUID(uuid(r.id())).addString(r.status().name()).addInteger(r.step())
                .addOffsetDateTime(time(r.nextAt())).addString(r.lastError()).addOffsetDateTime(time(r.updatedAt()));
        return query(pool.get(), UPDATE_IF_WAITING, params).rowCount() > 0;
    }

    @Override
    public List<Run> waiting(String tenantCode, String contextKind, String contextKey) {
        return runs(query(pool.get(), WAITING, Tuple.of(tenantCode, contextKind, contextKey)));
    }

    @Override
    public Optional<Run> waitingOnConversation(String tenantCode, String conversationId) {
        UUID id = uuidOrNull(conversationId);
        if (id == null) {
            return Optional.empty();
        }
        return runs(query(pool.get(), WAITING_ON_CONVERSATION, Tuple.of(tenantCode, id))).stream().findFirst();
    }

    @Override
    public List<RunRow> list(String tenantCode, String ruleId, Run.Status status, int limit) {
        UUID rule = uuidOrNull(ruleId);
        if (ruleId != null && rule == null) {
            return List.of();
        }
        Tuple params = Tuple.tuple().addString(tenantCode).addUUID(rule)
                .addString(status == null ? null : status.name()).addInteger(limit);
        List<RunRow> out = new ArrayList<>();
        for (Row row : query(pool.get(), LIST, params)) {
            out.add(new RunRow(run(row), row.getString("rule_name"), row.getString("event_type"),
                    row.getString("symptom_name"), row.getString("asset_id")));
        }
        return out;
    }

    @Override
    public List<RunMessage> messages(Collection<String> runIds) {
        if (runIds.isEmpty()) {
            return List.of();
        }
        UUID[] ids = runIds.stream().map(Pg::uuid).toArray(UUID[]::new);
        List<RunMessage> out = new ArrayList<>();
        for (Row r : query(pool.get(), MESSAGES, Tuple.tuple().addArrayOfUUID(ids))) {
            out.add(new RunMessage(string(r, "id"), string(r, "run_id"), r.getInteger("step"), r.getString("channel"),
                    r.getString("address"), r.getString("display_name"), r.getString("status"), r.getString("body"),
                    instant(r, "created_at")));
        }
        return out;
    }

    private static StoredEvent event(Row r) {
        return new StoredEvent(string(r, "id"), r.getString("tenant_code"), r.getString("type"), r.getString("source"),
                r.getString("context_kind"), r.getString("context_key"), Pg.map(r.getString("data")),
                r.getBoolean("test"), instant(r, "at"), instant(r, "received_at"));
    }

    private static List<Run> runs(RowSet<Row> rows) {
        List<Run> out = new ArrayList<>();
        rows.forEach(r -> out.add(run(r)));
        return out;
    }

    private static Run run(Row r) {
        return new Run(string(r, "id"), r.getString("tenant_code"), string(r, "rule_id"), r.getString("rule_version"),
                string(r, "event_id"), r.getString("context_kind"), r.getString("context_key"), r.getBoolean("test"),
                Run.Status.valueOf(r.getString("status")), r.getInteger("step"), instant(r, "next_at"),
                r.getString("last_error"), instant(r, "created_at"), instant(r, "updated_at"),
                recipients(r.getString("recipients")), r.getString("invocation_key"));
    }

    private static Map<String, List<Invocation.Person>> recipients(String text) {
        if (text == null) {
            return Map.of();
        }
        try {
            return Pg.JSON.readValue(text, RECIPIENTS);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("conv_run.recipients is not valid JSON", e);
        }
    }
}

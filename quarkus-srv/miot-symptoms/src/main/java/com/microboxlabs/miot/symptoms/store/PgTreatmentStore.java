package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;
import static com.microboxlabs.miot.symptoms.store.PgIds.parse;
import static com.microboxlabs.miot.symptoms.store.PgIds.query;
import static com.microboxlabs.miot.symptoms.store.PgIds.text;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.symptoms.catalog.store.PgJson;
import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link TreatmentStore} on the modulith database, schema {@code miot_symptoms}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgTreatmentStore implements TreatmentStore {

    private static final TypeReference<List<String>> TAGS = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> DETAILS = new TypeReference<>() {
    };
    private static final String TENANT_CODE = "tenant_code";
    private static final String DETAILS_JSON = detailsJson("details");
    private static final String CLAIMED_DETAILS_JSON = detailsJson("claimed.details");

    private static final String TREATMENT_COLUMNS = """
            id, tenant_code, symptom_id, asset_id, trip_id, type, status, opened_by, opened_at, closed_by,
            closed_at, resolution, note, updated_at""";

    private static final String SELECT_TREATMENTS = "SELECT " + TREATMENT_COLUMNS
            + " FROM miot_symptoms.treatment WHERE tenant_code = $1 ";

    // A second OPEN episode for the same operator and symptom hits idx_treatment_one_open;
    // insert() then returns the one already open.
    private static final String INSERT_TREATMENT = "INSERT INTO miot_symptoms.treatment (" + TREATMENT_COLUMNS + """
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (tenant_code, symptom_id, opened_by) WHERE status = 'OPEN' DO NOTHING
            RETURNING\s""" + TREATMENT_COLUMNS;

    private static final String LOCK_ENGINE_CASE = """
            SELECT id FROM miot_symptoms.signal_transitions
             WHERE tenant_code = $1 AND id = $2 AND kind = 'OPENED' FOR UPDATE
            """;
    private static final String ENGINE_CASE_CLOSED = """
            SELECT 1 FROM miot_symptoms.signal_transitions o
              JOIN miot_symptoms.signal_transitions c
                ON c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
               AND c.asset_id = o.asset_id AND c.state = o.state AND c.kind = 'CLOSED' AND c.id > o.id
             WHERE o.tenant_code = $1 AND o.id = $2
            """;

    private static final String TRANSITION = """
            UPDATE miot_symptoms.treatment
            SET status = $3, closed_by = $4, closed_at = $5, resolution = $6, note = COALESCE($7, note),
                updated_at = $5
            WHERE tenant_code = $1 AND id = $2 AND status = 'OPEN'
            RETURNING\s""" + TREATMENT_COLUMNS;

    private static final String ACTION_COLUMNS = """
            id, treatment_id, tenant_code, seq, kind, contact_id, contact_name, contact_role, contact_phone,
            method, outcome_key, outcome_label, answered, duration_seconds, message, note, tags, details,
            performed_by, performed_at""";

    // Locks the episode row: concurrent actions get distinct seq numbers, and an
    // action racing a close either lands first or finds the episode closed.
    private static final String TOUCH_TREATMENT = """
            UPDATE miot_symptoms.treatment SET updated_at = $3,
                type = CASE WHEN symptom_id < 0 AND $4 = 'IGNORE' THEN 'IGNORE_CONDITION' ELSE type END
            WHERE tenant_code = $1 AND id = $2 AND status = 'OPEN'
            RETURNING id""";

    private static final String NEXT_SEQ = """
            SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq
            FROM miot_symptoms.treatment_action WHERE treatment_id = $1""";

    private static final String INSERT_ACTION = "INSERT INTO miot_symptoms.treatment_action (" + ACTION_COLUMNS
            + """
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::text::jsonb,
                $18::text::jsonb, $19, $20)
            RETURNING\s""" + ACTION_COLUMNS;

    private static final String SELECT_ACTIONS = "SELECT " + ACTION_COLUMNS + """
             FROM miot_symptoms.treatment_action
            WHERE tenant_code = $1 AND treatment_id = ANY($2)
            ORDER BY array_position($2, treatment_id), seq""";

    private static final String PENDING_CALLS = "SELECT " + ACTION_COLUMNS + """
             FROM miot_symptoms.treatment_action
            WHERE tenant_code = $1 AND kind = 'CALL' AND performed_by = $2 AND performed_at >= $3
              AND %s #>> '{telephony,status}' = 'PENDING'
            ORDER BY performed_at LIMIT 50""".formatted(DETAILS_JSON);

    private static final String PENDING_TEAMS_CALLERS = """
            SELECT DISTINCT tenant_code, performed_by FROM miot_symptoms.treatment_action
            WHERE kind = 'CALL' AND performed_at >= $1 AND performed_by IS NOT NULL
              AND %s #>> '{telephony,status}' = 'PENDING'
              AND %s #>> '{telephony,provider}' = 'TEAMS_PHONE'
            ORDER BY tenant_code, performed_by LIMIT $2""".formatted(DETAILS_JSON, DETAILS_JSON);

    private static final String UPDATE_CALL = """
            UPDATE miot_symptoms.treatment_action
            SET answered = $3, duration_seconds = COALESCE($4, duration_seconds),
                details = $5::text::jsonb
            WHERE tenant_code = $1 AND id = $2 AND kind = 'CALL'
              AND %s #>> '{telephony,status}' = 'PENDING'
              AND NOT EXISTS (
                  SELECT 1 FROM miot_symptoms.treatment_action claimed
                  WHERE claimed.tenant_code = $1 AND claimed.id <> $2 AND claimed.kind = 'CALL'
                    AND %s #>> '{telephony,provider}' = 'TEAMS_PHONE'
                    AND %s #>> '{telephony,status}' = 'RECORDED'
                    AND %s #>> '{telephony,connectionId}' = $5::text::jsonb #>> '{telephony,connectionId}'
                    AND %s #>> '{telephony,recordId}' = $5::text::jsonb #>> '{telephony,recordId}'
              )
            RETURNING\s""".formatted(DETAILS_JSON, CLAIMED_DETAILS_JSON, CLAIMED_DETAILS_JSON,
                    CLAIMED_DETAILS_JSON, CLAIMED_DETAILS_JSON) + ACTION_COLUMNS;

    private static final String LOCK_CALL_RECORDS =
            "SELECT pg_advisory_xact_lock(hashtext('miot_symptoms.teams_records'), hashtext($1))";

    private static final String RECORDED_CALLS = """
            SELECT %s #>> '{telephony,recordId}' AS record_id FROM miot_symptoms.treatment_action
            WHERE tenant_code = $1 AND kind = 'CALL'
              AND %s #>> '{telephony,provider}' = 'TEAMS_PHONE'
              AND %s #>> '{telephony,status}' = 'RECORDED'
              AND %s #>> '{telephony,connectionId}' = $2
              AND %s #>> '{telephony,recordId}' IS NOT NULL""".formatted(DETAILS_JSON, DETAILS_JSON, DETAILS_JSON,
                    DETAILS_JSON, DETAILS_JSON);

    private static final String CONTACT_STATS = """
            SELECT contact_id,
                   MAX(performed_at) AS last_called_at,
                   COUNT(*) FILTER (WHERE answered IS TRUE) AS answered,
                   COUNT(*) FILTER (WHERE answered IS FALSE) AS missed
            FROM miot_symptoms.treatment_action
            WHERE tenant_code = $1 AND kind = 'CALL' AND contact_id IS NOT NULL
            GROUP BY contact_id""";
    private static final String PAGE_CONTACT_STATS = CONTACT_STATS.replace(
            "GROUP BY contact_id", "AND contact_id = ANY($2) GROUP BY contact_id");

    private static final String FIRST_OPENED = """
            SELECT symptom_id, min(opened_at) AS opened_at FROM miot_symptoms.treatment
            WHERE tenant_code = $1 AND symptom_id = ANY($2)
            GROUP BY symptom_id""";

    private final Supplier<Pool> pool;

    /** Older writers encoded JSON as a JSON string; new writes bind text before casting to jsonb. */
    private static String detailsJson(String column) {
        return "(CASE jsonb_typeof(" + column + ") WHEN 'string' THEN (" + column
                + " #>> '{}')::jsonb ELSE " + column + " END)";
    }

    @Inject
    PgTreatmentStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgTreatmentStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Inserted insert(Treatment t) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        OffsetDateTime openedAt = t.openedAt() == null ? now : t.openedAt();
        TreatmentStatus status = t.status() == null ? TreatmentStatus.OPEN : t.status();
        Tuple params = Tuple.tuple()
                .addUUID(UUID.randomUUID()).addString(t.tenantCode()).addLong(t.symptomId())
                .addString(t.assetId()).addString(t.tripId()).addString(t.type().name())
                .addString(status.name()).addString(t.openedBy()).addOffsetDateTime(openedAt)
                .addString(t.closedBy()).addOffsetDateTime(t.closedAt()).addString(t.resolution())
                .addString(t.note()).addOffsetDateTime(t.updatedAt() == null ? openedAt : t.updatedAt());
        if (t.symptomId() < 0) {
            return insertOnEngineCase(t, params);
        }
        List<Treatment> saved = treatments(query(pool.get(), INSERT_TREATMENT, params));
        if (!saved.isEmpty()) {
            return new Inserted(saved.get(0), true);
        }
        return new Inserted(findOpen(t.tenantCode(), t.symptomId(), t.openedBy())
                .orElseThrow(() -> new IllegalStateException("could not open treatment")), false);
    }

    /** Check, insert and resume under the case's lock, so a close cannot slip between them. */
    private Inserted insertOnEngineCase(Treatment t, Tuple params) {
        Tuple key = Tuple.of(t.tenantCode(), -t.symptomId());
        return pool.get().withTransaction(tx -> tx.preparedQuery(LOCK_ENGINE_CASE).execute(key)
                .invoke(rows -> {
                    if (!rows.iterator().hasNext()) throw new NoSuchElementException("case not found");
                })
                .flatMap(ignored -> tx.preparedQuery(ENGINE_CASE_CLOSED).execute(key))
                .invoke(rows -> {
                    if (rows.iterator().hasNext()) throw new IllegalStateException("the case is closed");
                })
                .flatMap(ignored -> tx.preparedQuery(INSERT_TREATMENT).execute(params))
                .flatMap(rows -> {
                    List<Treatment> saved = treatments(rows);
                    if (!saved.isEmpty()) return Uni.createFrom().item(new Inserted(saved.get(0), true));
                    return tx.preparedQuery(SELECT_TREATMENTS
                            + " AND symptom_id = $2 AND opened_by = $3 AND status = 'OPEN'")
                            .execute(Tuple.of(t.tenantCode(), t.symptomId(), t.openedBy()))
                            .map(open -> new Inserted(treatments(open).get(0), false));
                })).await().atMost(QUERY_TIMEOUT);
    }

    @Override
    public Optional<Treatment> find(String tenantCode, String id) {
        UUID uuid = parse(id);
        if (uuid == null) {
            return Optional.empty();
        }
        return treatments(query(pool.get(), SELECT_TREATMENTS + "AND id = $2", Tuple.of(tenantCode, uuid)))
                .stream().findFirst();
    }

    @Override
    public Optional<Treatment> findOpen(String tenantCode, long symptomId, String actor) {
        String sql = SELECT_TREATMENTS + """
                AND symptom_id = $2 AND status = 'OPEN' AND opened_by IS NOT DISTINCT FROM $3
                ORDER BY opened_at DESC LIMIT 1""";
        return treatments(query(pool.get(), sql, Tuple.of(tenantCode, symptomId, actor))).stream().findFirst();
    }

    @Override
    public Map<Long, OffsetDateTime> firstOpenedAt(String tenantCode, Collection<Long> symptomIds) {
        if (symptomIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, OffsetDateTime> out = new HashMap<>();
        for (Row r : query(pool.get(), FIRST_OPENED, Tuple.of(tenantCode, symptomIds.toArray(Long[]::new)))) {
            out.put(r.getLong("symptom_id"), r.getOffsetDateTime("opened_at"));
        }
        return out;
    }

    @Override
    public List<Treatment> listBySymptom(String tenantCode, long symptomId) {
        return treatments(query(pool.get(), SELECT_TREATMENTS + "AND symptom_id = $2 ORDER BY opened_at, id",
                Tuple.of(tenantCode, symptomId)));
    }

    @Override
    public Optional<Treatment> transition(
            String tenantCode, String id, TreatmentStatus status, String actor, String resolution, String note,
            OffsetDateTime at) {
        UUID uuid = parse(id);
        if (uuid == null) {
            return Optional.empty();
        }
        Tuple params = Tuple.tuple()
                .addString(tenantCode).addUUID(uuid).addString(status.name()).addString(actor)
                .addOffsetDateTime(at == null ? OffsetDateTime.now(ZoneOffset.UTC) : at).addString(resolution)
                .addString(note);
        return treatments(query(pool.get(), TRANSITION, params)).stream().findFirst();
    }

    @Override
    public TreatmentAction addAction(TreatmentAction a) {
        UUID treatmentId = parse(a.treatmentId());
        if (treatmentId == null) {
            throw new IllegalStateException("treatment not found: " + a.treatmentId());
        }
        UUID contactId = parse(a.contactId());
        if (a.contactId() != null && contactId == null) {
            throw new IllegalArgumentException("contactId not found: " + a.contactId());
        }
        OffsetDateTime performedAt = a.performedAt() == null ? OffsetDateTime.now(ZoneOffset.UTC) : a.performedAt();
        return pool.get().withTransaction(tx -> tx.preparedQuery(TOUCH_TREATMENT)
                        .execute(Tuple.of(a.tenantCode(), treatmentId, performedAt, a.kind().name()))
                        .flatMap(touched -> {
                            if (touched.rowCount() == 0) {
                                throw new IllegalStateException(
                                        "treatment not found or not open: " + a.treatmentId());
                            }
                            return tx.preparedQuery(NEXT_SEQ).execute(Tuple.of(treatmentId));
                        })
                        .flatMap(next -> tx.preparedQuery(INSERT_ACTION).execute(actionParams(
                                a, treatmentId, contactId, next.iterator().next().getInteger("next_seq"),
                                performedAt)))
                        .map(rows -> actions(rows).get(0)))
                .await().atMost(QUERY_TIMEOUT);
    }

    @Override
    public List<TreatmentAction> listActions(String tenantCode, List<String> treatmentIds) {
        UUID[] ids = treatmentIds.stream().map(PgIds::parse).filter(Objects::nonNull).toArray(UUID[]::new);
        if (ids.length == 0) {
            return List.of();
        }
        return actions(query(pool.get(), SELECT_ACTIONS, Tuple.of(tenantCode, ids)));
    }

    @Override
    public List<ContactCallStats> contactStats(String tenantCode) {
        return stats(query(pool.get(), CONTACT_STATS, Tuple.of(tenantCode)));
    }

    @Override
    public List<ContactCallStats> contactStats(String tenantCode, List<String> contactIds) {
        UUID[] ids = contactIds.stream().map(PgIds::parse).filter(Objects::nonNull).toArray(UUID[]::new);
        if (ids.length == 0) {
            return List.of();
        }
        return stats(query(pool.get(), PAGE_CONTACT_STATS, Tuple.of(tenantCode, ids)));
    }

    private static List<ContactCallStats> stats(RowSet<Row> rows) {
        return rows.stream()
                .map(r -> new ContactCallStats(text(r.getUUID("contact_id")), PgJson.time(r, "last_called_at"),
                        r.getLong("answered"), r.getLong("missed")))
                .toList();
    }

    private static Tuple actionParams(
            TreatmentAction a, UUID treatmentId, UUID contactId, int seq, OffsetDateTime performedAt) {
        return Tuple.tuple()
                .addUUID(UUID.randomUUID()).addUUID(treatmentId).addString(a.tenantCode()).addInteger(seq)
                .addString(a.kind().name()).addUUID(contactId).addString(a.contactName())
                .addString(a.contactRole()).addString(a.contactPhone())
                .addString(a.method() == null ? null : a.method().name())
                .addString(a.outcomeKey()).addString(a.outcomeLabel()).addBoolean(a.answered())
                .addInteger(a.durationSeconds()).addString(a.message()).addString(a.note())
                .addString(PgJson.write(a.tags() == null ? List.of() : a.tags()))
                .addString(PgJson.write(a.details() == null ? Map.of() : a.details()))
                .addString(a.performedBy()).addOffsetDateTime(performedAt);
    }

    private static List<Treatment> treatments(RowSet<Row> rows) {
        return rows.stream().map(PgTreatmentStore::treatment).toList();
    }

    private static Treatment treatment(Row r) {
        return new Treatment(
                text(r.getUUID("id")), r.getString(TENANT_CODE), r.getLong("symptom_id"),
                r.getString("asset_id"), r.getString("trip_id"), TreatmentType.valueOf(r.getString("type")),
                TreatmentStatus.valueOf(r.getString("status")), r.getString("opened_by"),
                PgJson.time(r, "opened_at"), r.getString("closed_by"), PgJson.time(r, "closed_at"),
                r.getString("resolution"), r.getString("note"), PgJson.time(r, "updated_at"));
    }

    private static List<TreatmentAction> actions(RowSet<Row> rows) {
        return rows.stream().map(PgTreatmentStore::action).toList();
    }

    private static TreatmentAction action(Row r) {
        String method = r.getString("method");
        return new TreatmentAction(
                text(r.getUUID("id")), text(r.getUUID("treatment_id")), r.getString(TENANT_CODE),
                r.getInteger("seq"), ActionKind.valueOf(r.getString("kind")), text(r.getUUID("contact_id")),
                r.getString("contact_name"), r.getString("contact_role"), r.getString("contact_phone"),
                method == null ? null : CallMethod.valueOf(method), r.getString("outcome_key"),
                r.getString("outcome_label"), r.getBoolean("answered"), r.getInteger("duration_seconds"),
                r.getString("message"), r.getString("note"), PgJson.read(r, "tags", TAGS),
                PgJson.read(r, "details", DETAILS), r.getString("performed_by"),
                PgJson.time(r, "performed_at"));
    }

    @Override
    public List<TreatmentAction> pendingTelephonyCalls(String tenantCode, String performedBy,
            OffsetDateTime since) {
        return actions(query(pool.get(), PENDING_CALLS, Tuple.of(tenantCode, performedBy, since)));
    }

    @Override
    public List<Caller> pendingTeamsCallers(OffsetDateTime since, int limit) {
        return query(pool.get(), PENDING_TEAMS_CALLERS, Tuple.of(since, limit)).stream()
                .map(r -> new Caller(r.getString(TENANT_CODE), r.getString("performed_by"))).toList();
    }

    @Override
    public Optional<TreatmentAction> updateCallResult(String tenantCode, String actionId, Boolean answered,
            Integer durationSeconds, Map<String, Object> details) {
        UUID id = parse(actionId);
        if (id == null) {
            return Optional.empty();
        }
        Tuple params = Tuple.tuple().addString(tenantCode).addUUID(id).addBoolean(answered)
                .addInteger(durationSeconds).addString(PgJson.write(details == null ? Map.of() : details));
        // The update takes a fresh statement snapshot after the shared lock is acquired, so a
        // concurrent request cannot claim the same record or replace a confirmed result with PENDING.
        RowSet<Row> rows = pool.get().withTransaction(connection ->
                connection.preparedQuery(LOCK_CALL_RECORDS).execute(Tuple.of(tenantCode))
                        .flatMap(ignored -> connection.preparedQuery(UPDATE_CALL).execute(params)))
                .await().atMost(QUERY_TIMEOUT);
        return actions(rows).stream().findFirst();
    }

    @Override
    public Set<String> recordedTelephonyRecordIds(String tenantCode, String connectionId) {
        Set<String> ids = new HashSet<>();
        query(pool.get(), RECORDED_CALLS, Tuple.of(tenantCode, connectionId))
                .forEach(row -> ids.add(row.getString("record_id")));
        return Set.copyOf(ids);
    }
}

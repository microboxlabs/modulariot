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
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
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

    private static final String TREATMENT_COLUMNS = """
            id, tenant_code, symptom_id, asset_id, trip_id, type, status, opened_by, opened_at, closed_by,
            closed_at, resolution, note, updated_at""";

    private static final String SELECT_TREATMENTS = "SELECT " + TREATMENT_COLUMNS
            + " FROM miot_symptoms.treatment WHERE tenant_code = $1 ";

    // A second OPEN episode for the same operator and symptom hits idx_treatment_one_open;
    // insert() then returns the one already open.
    private static final String INSERT_TREATMENT = """
            INSERT INTO miot_symptoms.treatment (""" + TREATMENT_COLUMNS + """
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (tenant_code, symptom_id, opened_by) WHERE status = 'OPEN' DO NOTHING
            RETURNING\s""" + TREATMENT_COLUMNS;

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
            UPDATE miot_symptoms.treatment SET updated_at = $3
            WHERE tenant_code = $1 AND id = $2 AND status = 'OPEN'
            RETURNING id""";

    private static final String NEXT_SEQ = """
            SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq
            FROM miot_symptoms.treatment_action WHERE treatment_id = $1""";

    private static final String INSERT_ACTION = """
            INSERT INTO miot_symptoms.treatment_action (""" + ACTION_COLUMNS + """
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb,
                $18::jsonb, $19, $20)
            RETURNING\s""" + ACTION_COLUMNS;

    private static final String SELECT_ACTIONS = "SELECT " + ACTION_COLUMNS + """
             FROM miot_symptoms.treatment_action
            WHERE tenant_code = $1 AND treatment_id = ANY($2)
            ORDER BY array_position($2, treatment_id), seq""";

    private static final String CONTACT_STATS = """
            SELECT contact_id,
                   MAX(performed_at) AS last_called_at,
                   COUNT(*) FILTER (WHERE answered IS TRUE) AS answered,
                   COUNT(*) FILTER (WHERE answered IS FALSE) AS missed
            FROM miot_symptoms.treatment_action
            WHERE tenant_code = $1 AND kind = 'CALL' AND contact_id IS NOT NULL
            GROUP BY contact_id""";

    private final Supplier<Pool> pool;

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
        List<Treatment> saved = treatments(query(pool.get(), INSERT_TREATMENT, params));
        if (!saved.isEmpty()) {
            return new Inserted(saved.get(0), true);
        }
        return new Inserted(findOpen(t.tenantCode(), t.symptomId(), t.openedBy())
                .orElseThrow(() -> new IllegalStateException("could not open treatment")), false);
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
                        .execute(Tuple.of(a.tenantCode(), treatmentId, performedAt))
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
        List<ContactCallStats> out = new ArrayList<>();
        for (Row r : query(pool.get(), CONTACT_STATS, Tuple.of(tenantCode))) {
            out.add(new ContactCallStats(text(r.getUUID("contact_id")), PgJson.time(r, "last_called_at"),
                    r.getLong("answered"), r.getLong("missed")));
        }
        return out;
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
        List<Treatment> out = new ArrayList<>();
        for (Row r : rows) {
            out.add(new Treatment(
                    text(r.getUUID("id")), r.getString("tenant_code"), r.getLong("symptom_id"),
                    r.getString("asset_id"), r.getString("trip_id"), TreatmentType.valueOf(r.getString("type")),
                    TreatmentStatus.valueOf(r.getString("status")), r.getString("opened_by"),
                    PgJson.time(r, "opened_at"), r.getString("closed_by"), PgJson.time(r, "closed_at"),
                    r.getString("resolution"), r.getString("note"), PgJson.time(r, "updated_at")));
        }
        return out;
    }

    private static List<TreatmentAction> actions(RowSet<Row> rows) {
        List<TreatmentAction> out = new ArrayList<>();
        for (Row r : rows) {
            String method = r.getString("method");
            out.add(new TreatmentAction(
                    text(r.getUUID("id")), text(r.getUUID("treatment_id")), r.getString("tenant_code"),
                    r.getInteger("seq"), ActionKind.valueOf(r.getString("kind")), text(r.getUUID("contact_id")),
                    r.getString("contact_name"), r.getString("contact_role"), r.getString("contact_phone"),
                    method == null ? null : CallMethod.valueOf(method), r.getString("outcome_key"),
                    r.getString("outcome_label"), r.getBoolean("answered"), r.getInteger("duration_seconds"),
                    r.getString("message"), r.getString("note"), PgJson.read(r, "tags", TAGS),
                    PgJson.read(r, "details", DETAILS), r.getString("performed_by"),
                    PgJson.time(r, "performed_at")));
        }
        return out;
    }
}

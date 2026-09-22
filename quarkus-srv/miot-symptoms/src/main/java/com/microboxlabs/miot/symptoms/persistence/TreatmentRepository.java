package com.microboxlabs.miot.symptoms.persistence;

import static com.microboxlabs.miot.symptoms.persistence.RowMappers.stringList;
import static com.microboxlabs.miot.symptoms.persistence.RowMappers.toJson;
import static com.microboxlabs.miot.symptoms.persistence.RowMappers.toJsonArray;
import static com.microboxlabs.miot.symptoms.persistence.RowMappers.toMap;
import static com.microboxlabs.miot.symptoms.persistence.RowMappers.toUuid;
import static com.microboxlabs.miot.symptoms.persistence.RowMappers.uuid;

import com.microboxlabs.miot.symptoms.domain.ActionKind;
import com.microboxlabs.miot.symptoms.domain.CallMethod;
import com.microboxlabs.miot.symptoms.domain.ContactCallStats;
import com.microboxlabs.miot.symptoms.domain.Treatment;
import com.microboxlabs.miot.symptoms.domain.TreatmentAction;
import com.microboxlabs.miot.symptoms.domain.TreatmentStatus;
import com.microboxlabs.miot.symptoms.domain.TreatmentType;
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

/**
 * Treatments and their actions in {@code miot_symptoms}. Vert.x reactive PG on
 * the modulith datasource, blocking via {@code await().indefinitely()} like the
 * integrations repositories. The {@code protected} constructor lets unit tests
 * subclass with a null pool.
 */
@ApplicationScoped
public class TreatmentRepository {

    private static final String TREATMENT_COLUMNS = """
            id, tenant_code, symptom_id, asset_id, trip_id, type, status, opened_by, opened_at,
            closed_by, closed_at, resolution, note, legacy_treatment_id, idempotency_key, updated_at""";

    private static final String ACTION_COLUMNS = """
            id, treatment_id, tenant_code, seq, kind, contact_id, contact_name, contact_role, contact_phone,
            method, outcome_key, outcome_label, answered, duration_seconds, note, tags, details,
            performed_by, performed_at""";

    private static final String INSERT_TREATMENT = """
            INSERT INTO miot_symptoms.treatments (
                tenant_code, symptom_id, asset_id, trip_id, type, status, opened_by, note,
                legacy_treatment_id, idempotency_key
            ) VALUES ($1, $2, $3, $4, $5, 'OPEN', $6, $7, $8, $9)
            RETURNING %s""".formatted(TREATMENT_COLUMNS);

    private static final String FIND_BY_ID = """
            SELECT %s FROM miot_symptoms.treatments
            WHERE tenant_code = $1 AND id = $2""".formatted(TREATMENT_COLUMNS);

    private static final String FIND_BY_IDEMPOTENCY_KEY = """
            SELECT %s FROM miot_symptoms.treatments
            WHERE tenant_code = $1 AND idempotency_key = $2""".formatted(TREATMENT_COLUMNS);

    private static final String LIST_BY_SYMPTOM = """
            SELECT %s FROM miot_symptoms.treatments
            WHERE tenant_code = $1 AND symptom_id = $2
            ORDER BY opened_at""".formatted(TREATMENT_COLUMNS);

    private static final String TRANSITION = """
            UPDATE miot_symptoms.treatments
            SET status = $3, closed_by = $4, closed_at = now(), resolution = $5,
                note = COALESCE($6, note), updated_at = now()
            WHERE tenant_code = $1 AND id = $2 AND status = 'OPEN'
            RETURNING %s""".formatted(TREATMENT_COLUMNS);

    private static final String INSERT_ACTION = """
            INSERT INTO miot_symptoms.treatment_actions (
                treatment_id, tenant_code, seq, kind, contact_id, contact_name, contact_role, contact_phone,
                method, outcome_key, outcome_label, answered, duration_seconds, note, tags, details, performed_by
            ) VALUES (
                $1, $2,
                (SELECT COALESCE(MAX(seq), 0) + 1 FROM miot_symptoms.treatment_actions WHERE treatment_id = $1),
                $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )
            RETURNING %s""".formatted(ACTION_COLUMNS);

    private static final String LIST_ACTIONS = """
            SELECT %s FROM miot_symptoms.treatment_actions
            WHERE tenant_code = $1 AND treatment_id = ANY($2)
            ORDER BY treatment_id, seq""".formatted(ACTION_COLUMNS);

    private static final String CONTACT_STATS = """
            SELECT contact_id,
                   MAX(performed_at) AS last_called_at,
                   COUNT(*) FILTER (WHERE answered IS TRUE)  AS answered,
                   COUNT(*) FILTER (WHERE answered IS FALSE) AS missed
            FROM miot_symptoms.treatment_actions
            WHERE tenant_code = $1 AND kind = 'CALL' AND contact_id IS NOT NULL
            GROUP BY contact_id""";

    private final Instance<Pool> clientInstance;

    protected TreatmentRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public Treatment insert(Treatment t) {
        Tuple params = Tuple.tuple()
                .addString(t.tenantCode())
                .addLong(t.symptomId())
                .addString(t.assetId())
                .addString(t.tripId())
                .addString(t.type().name())
                .addString(t.openedBy())
                .addString(t.note())
                .addLong(t.legacyTreatmentId())
                .addString(t.idempotencyKey());
        return single(client().preparedQuery(INSERT_TREATMENT).execute(params).await().indefinitely())
                .map(this::mapTreatment)
                .orElse(null);
    }

    public Optional<Treatment> findById(String tenantCode, String id) {
        UUID uuid = toUuid(id);
        if (uuid == null) {
            return Optional.empty();
        }
        return single(client().preparedQuery(FIND_BY_ID)
                .execute(Tuple.of(tenantCode, uuid)).await().indefinitely())
                .map(this::mapTreatment);
    }

    public Optional<Treatment> findByIdempotencyKey(String tenantCode, String key) {
        return single(client().preparedQuery(FIND_BY_IDEMPOTENCY_KEY)
                .execute(Tuple.of(tenantCode, key)).await().indefinitely())
                .map(this::mapTreatment);
    }

    public List<Treatment> listBySymptom(String tenantCode, long symptomId) {
        RowSet<Row> rows = client().preparedQuery(LIST_BY_SYMPTOM)
                .execute(Tuple.of(tenantCode, symptomId)).await().indefinitely();
        List<Treatment> out = new ArrayList<>();
        rows.forEach(row -> out.add(mapTreatment(row)));
        return out;
    }

    /** Moves an OPEN treatment to CLOSED or CANCELLED; empty when it was not open (or not found). */
    public Optional<Treatment> transition(
            String tenantCode, String id, TreatmentStatus status, String actor, String resolution, String note) {
        Tuple params = Tuple.tuple()
                .addString(tenantCode)
                .addUUID(toUuid(id))
                .addString(status.name())
                .addString(actor)
                .addString(resolution)
                .addString(note);
        return single(client().preparedQuery(TRANSITION).execute(params).await().indefinitely())
                .map(this::mapTreatment);
    }

    public TreatmentAction insertAction(TreatmentAction a) {
        Tuple params = Tuple.tuple()
                .addUUID(toUuid(a.treatmentId()))
                .addString(a.tenantCode())
                .addString(a.kind().name())
                .addUUID(toUuid(a.contactId()))
                .addString(a.contactName())
                .addString(a.contactRole())
                .addString(a.contactPhone())
                .addString(a.method() == null ? null : a.method().name())
                .addString(a.outcomeKey())
                .addString(a.outcomeLabel())
                .addBoolean(a.answered())
                .addInteger(a.durationSeconds())
                .addString(a.note())
                .addJsonArray(toJsonArray(a.tags()))
                .addJsonObject(toJson(a.details()))
                .addString(a.performedBy());
        return single(client().preparedQuery(INSERT_ACTION).execute(params).await().indefinitely())
                .map(this::mapAction)
                .orElse(null);
    }

    public List<TreatmentAction> listActions(String tenantCode, List<String> treatmentIds) {
        if (treatmentIds == null || treatmentIds.isEmpty()) {
            return List.of();
        }
        UUID[] ids = treatmentIds.stream().map(RowMappers::toUuid).toArray(UUID[]::new);
        RowSet<Row> rows = client().preparedQuery(LIST_ACTIONS)
                .execute(Tuple.of(tenantCode, ids)).await().indefinitely();
        List<TreatmentAction> out = new ArrayList<>();
        rows.forEach(row -> out.add(mapAction(row)));
        return out;
    }

    public List<ContactCallStats> contactStats(String tenantCode) {
        RowSet<Row> rows = client().preparedQuery(CONTACT_STATS)
                .execute(Tuple.of(tenantCode)).await().indefinitely();
        List<ContactCallStats> out = new ArrayList<>();
        rows.forEach(row -> out.add(new ContactCallStats(
                uuid(row, "contact_id"),
                row.getOffsetDateTime("last_called_at"),
                row.getLong("answered"),
                row.getLong("missed"))));
        return out;
    }

    private Pool client() {
        return clientInstance.get();
    }

    private static Optional<Row> single(RowSet<Row> rows) {
        return rows.iterator().hasNext() ? Optional.of(rows.iterator().next()) : Optional.empty();
    }

    private Treatment mapTreatment(Row row) {
        return new Treatment(
                uuid(row, "id"),
                row.getString("tenant_code"),
                row.getLong("symptom_id"),
                row.getString("asset_id"),
                row.getString("trip_id"),
                TreatmentType.valueOf(row.getString("type")),
                TreatmentStatus.valueOf(row.getString("status")),
                row.getString("opened_by"),
                row.getOffsetDateTime("opened_at"),
                row.getString("closed_by"),
                row.getOffsetDateTime("closed_at"),
                row.getString("resolution"),
                row.getString("note"),
                row.getLong("legacy_treatment_id"),
                row.getString("idempotency_key"),
                row.getOffsetDateTime("updated_at"));
    }

    private TreatmentAction mapAction(Row row) {
        String method = row.getString("method");
        return new TreatmentAction(
                uuid(row, "id"),
                uuid(row, "treatment_id"),
                row.getString("tenant_code"),
                row.getInteger("seq"),
                ActionKind.valueOf(row.getString("kind")),
                uuid(row, "contact_id"),
                row.getString("contact_name"),
                row.getString("contact_role"),
                row.getString("contact_phone"),
                method == null ? null : CallMethod.valueOf(method),
                row.getString("outcome_key"),
                row.getString("outcome_label"),
                row.getBoolean("answered"),
                row.getInteger("duration_seconds"),
                row.getString("note"),
                stringList(row.getJsonArray("tags")),
                toMap(row.getJsonObject("details")),
                row.getString("performed_by"),
                row.getOffsetDateTime("performed_at"));
    }
}

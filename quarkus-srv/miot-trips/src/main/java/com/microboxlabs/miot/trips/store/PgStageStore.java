package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.StageActivity;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowIterator;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link StageStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgStageStore implements StageStore {

    private static final String SELECT = "SELECT ";
    private static final String COLUMNS = """
            id, tenant_code, subject_type, subject_id, seq, stage_type, service_status, status, location_id,
            planned_start, planned_end, actual_start, actual_end, checklist::text AS checklist,
            created_at, created_by, updated_at, updated_by""";

    private static final String INSERT = """
            INSERT INTO miot_trips.stage
                (tenant_code, subject_type, subject_id, seq, stage_type, service_status, location_id,
                 planned_start, planned_end, checklist, created_by, updated_by)
            SELECT $1, $2::text, $3, COALESCE(max(seq), 0) + 1, $4, $5, $6, $7, $8, $9::text::jsonb, $10, $10
            FROM miot_trips.stage
            WHERE subject_type = $2 AND subject_id = $3 AND version_of IS NULL AND is_active
            RETURNING\s""" + COLUMNS;

    private static final String UPDATE = """
            UPDATE miot_trips.stage SET
                stage_type = $3, service_status = $4, location_id = $5, planned_start = $6,
                planned_end = $7, checklist = $8::text::jsonb, updated_by = $9, updated_at = now()
            WHERE id = $1 AND tenant_code = $2 AND version_of IS NULL
            RETURNING\s""" + COLUMNS;

    private static final String A_COLUMNS = """
            id, tenant_code, stage_id, seq, activity_type, status, assignee, assignment_id,
            evidence::text AS evidence, done_at, created_at, created_by, updated_at, updated_by""";

    private static final String A_INSERT = """
            INSERT INTO miot_trips.stage_activity
                (tenant_code, stage_id, seq, activity_type, assignee, evidence, created_by, updated_by)
            SELECT $1, $2, COALESCE(max(seq), 0) + 1, $3, $4, $5::text::jsonb, $6, $6
            FROM miot_trips.stage_activity WHERE stage_id = $2 AND version_of IS NULL AND is_active
            RETURNING\s""" + A_COLUMNS;

    private static final String A_UPDATE = """
            UPDATE miot_trips.stage_activity SET
                status = $3, assignee = $4, assignment_id = $5, evidence = $6::text::jsonb,
                done_at = $7, updated_by = $8, updated_at = now()
            WHERE id = $1 AND tenant_code = $2
            RETURNING\s""" + A_COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgStageStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgStageStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Stage insert(Stage s) {
        Tuple params = Tuple.tuple()
                .addString(s.tenantCode()).addString(s.subjectType()).addUUID(Pg.parse(s.subjectId()))
                .addString(s.stageType()).addString(s.serviceStatus()).addUUID(Pg.parse(s.locationId()))
                .addOffsetDateTime(s.plannedStart()).addOffsetDateTime(s.plannedEnd())
                .addString(s.checklist()).addString(s.createdBy());
        return stage(query(pool.get(), INSERT, params).iterator().next());
    }

    @Override
    public Optional<Stage> find(String tenantCode, UUID id) {
        return firstStage(query(pool.get(),
                SELECT + COLUMNS + " FROM miot_trips.stage WHERE tenant_code = $1 AND id = $2" + Pg.lock(),
                Tuple.of(tenantCode, id)));
    }

    @Override
    public List<Stage> listBySubject(String tenantCode, String subjectType, UUID subjectId) {
        return query(pool.get(),
                SELECT + COLUMNS + """
                 FROM miot_trips.stage
                WHERE tenant_code = $1 AND subject_type = $2 AND subject_id = $3
                  AND version_of IS NULL AND is_active ORDER BY seq""",
                Tuple.of(tenantCode, subjectType, subjectId))
                .stream().map(PgStageStore::stage).toList();
    }

    @Override
    public Optional<Stage> update(Stage s) {
        Tuple params = Tuple.tuple()
                .addUUID(Pg.parse(s.id())).addString(s.tenantCode())
                .addString(s.stageType()).addString(s.serviceStatus()).addUUID(Pg.parse(s.locationId()))
                .addOffsetDateTime(s.plannedStart()).addOffsetDateTime(s.plannedEnd())
                .addString(s.checklist()).addString(s.updatedBy());
        return firstStage(query(pool.get(), UPDATE, params));
    }

    @Override
    public Optional<Stage> start(String tenantCode, UUID id, OffsetDateTime at, String actor) {
        return firstStage(query(pool.get(), """
                UPDATE miot_trips.stage SET status = 'in_progress', actual_start = $3, updated_by = $4, updated_at = now()
                WHERE id = $1 AND tenant_code = $2 AND status = 'pending'
                RETURNING\s""" + COLUMNS,
                Tuple.of(id, tenantCode, at).addString(actor)));
    }

    @Override
    public Optional<Stage> close(String tenantCode, UUID id, OffsetDateTime at, String actor) {
        return firstStage(query(pool.get(), """
                UPDATE miot_trips.stage SET status = 'completed', actual_end = $3, updated_by = $4, updated_at = now()
                WHERE id = $1 AND tenant_code = $2 AND status = 'in_progress'
                RETURNING\s""" + COLUMNS,
                Tuple.of(id, tenantCode, at).addString(actor)));
    }

    @Override
    public StageActivity insertActivity(StageActivity a) {
        Tuple params = Tuple.tuple()
                .addString(a.tenantCode()).addUUID(Pg.parse(a.stageId())).addString(a.activityType())
                .addString(a.assignee()).addString(a.evidence()).addString(a.createdBy());
        return activity(query(pool.get(), A_INSERT, params).iterator().next());
    }

    @Override
    public Optional<StageActivity> findActivity(String tenantCode, UUID id) {
        return firstActivity(query(pool.get(),
                SELECT + A_COLUMNS + " FROM miot_trips.stage_activity WHERE tenant_code = $1 AND id = $2" + Pg.lock(),
                Tuple.of(tenantCode, id)));
    }

    @Override
    public List<StageActivity> listActivities(String tenantCode, UUID stageId) {
        return query(pool.get(),
                SELECT + A_COLUMNS + """
                 FROM miot_trips.stage_activity
                WHERE tenant_code = $1 AND stage_id = $2 AND version_of IS NULL AND is_active ORDER BY seq""",
                Tuple.of(tenantCode, stageId))
                .stream().map(PgStageStore::activity).toList();
    }

    @Override
    public Optional<StageActivity> updateActivity(StageActivity a) {
        Tuple params = Tuple.tuple()
                .addUUID(Pg.parse(a.id())).addString(a.tenantCode())
                .addString(a.status()).addString(a.assignee()).addUUID(Pg.parse(a.assignmentId()))
                .addString(a.evidence()).addOffsetDateTime(a.doneAt()).addString(a.updatedBy());
        return firstActivity(query(pool.get(), A_UPDATE, params));
    }

    private static Optional<Stage> firstStage(RowSet<Row> rows) {
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(stage(it.next())) : Optional.empty();
    }

    private static Optional<StageActivity> firstActivity(RowSet<Row> rows) {
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(activity(it.next())) : Optional.empty();
    }

    private static Stage stage(Row r) {
        return new Stage(
                text(r.getUUID("id")), r.getString("tenant_code"), r.getString("subject_type"),
                text(r.getUUID("subject_id")), r.getInteger("seq"), r.getString("stage_type"),
                r.getString("service_status"), r.getString("status"), text(r.getUUID("location_id")),
                time(r, "planned_start"), time(r, "planned_end"), time(r, "actual_start"), time(r, "actual_end"),
                r.getString("checklist"),
                time(r, "created_at"), r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"));
    }

    private static StageActivity activity(Row r) {
        return new StageActivity(
                text(r.getUUID("id")), r.getString("tenant_code"), text(r.getUUID("stage_id")),
                r.getInteger("seq"), r.getString("activity_type"), r.getString("status"),
                r.getString("assignee"), text(r.getUUID("assignment_id")), r.getString("evidence"),
                time(r, "done_at"),
                time(r, "created_at"), r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"));
    }
}

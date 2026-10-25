package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.trips.domain.FeedProfile;
import com.microboxlabs.miot.trips.domain.FeedService;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;

/** {@link FeedStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgFeedStore implements FeedStore {

    private static final String SELECT = "SELECT ";
    private static final String PROFILE_COLUMNS = """
            tenant_code, feed_key, name, stages, departure_stage, close_stage, close_tolerance_minutes,
            required_resources, active, created_at, created_by, updated_at, updated_by""";
    private static final String SERVICE_COLUMNS = """
            tenant_code, feed_key, external_code, desired, desired_hash, mandate_id, trip_id, open,
            last_action, last_result, last_reconciled_at""";
    private static final TypeReference<List<FeedProfile.StagePlan>> STAGES = new TypeReference<>() {
    };

    private final Supplier<Pool> pool;

    @Inject
    PgFeedStore(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgFeedStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Optional<FeedProfile> profile(String tenantCode, String feedKey) {
        return first(query(pool.get(), SELECT + PROFILE_COLUMNS
                + " FROM miot_trips.feed_profile WHERE tenant_code = $1 AND feed_key = $2",
                Tuple.of(tenantCode, feedKey)), PgFeedStore::profile);
    }

    @Override
    public List<FeedProfile> profiles(String tenantCode) {
        return query(pool.get(), SELECT + PROFILE_COLUMNS
                + " FROM miot_trips.feed_profile WHERE tenant_code = $1 ORDER BY feed_key", Tuple.of(tenantCode))
                .stream().map(PgFeedStore::profile).toList();
    }

    @Override
    public FeedProfile saveProfile(FeedProfile p) {
        return query(pool.get(), """
                INSERT INTO miot_trips.feed_profile
                    (tenant_code, feed_key, name, stages, departure_stage, close_stage, close_tolerance_minutes,
                     required_resources, active, created_by, updated_by)
                VALUES ($1, $2, $3, $4::text::jsonb, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (tenant_code, feed_key) DO UPDATE SET
                    name = EXCLUDED.name, stages = EXCLUDED.stages, departure_stage = EXCLUDED.departure_stage,
                    close_stage = EXCLUDED.close_stage, close_tolerance_minutes = EXCLUDED.close_tolerance_minutes,
                    required_resources = EXCLUDED.required_resources, active = EXCLUDED.active,
                    updated_by = EXCLUDED.updated_by, updated_at = now()
                RETURNING\s""" + PROFILE_COLUMNS,
                Tuple.tuple().addString(p.tenantCode()).addString(p.feedKey()).addString(p.name())
                        .addString(Pg.json(p.stages())).addString(p.departureStage()).addString(p.closeStage())
                        .addInteger(p.closeToleranceMinutes())
                        .addArrayOfString(p.requiredResources().toArray(String[]::new))
                        .addBoolean(p.active()).addString(p.createdBy()).addString(p.updatedBy()))
                .stream().map(PgFeedStore::profile).findFirst().orElseThrow();
    }

    @Override
    public Optional<FeedService> service(String tenantCode, String feedKey, String externalCode) {
        return first(query(pool.get(), SELECT + SERVICE_COLUMNS + " FROM miot_trips.feed_service"
                + " WHERE tenant_code = $1 AND feed_key = $2 AND external_code = $3" + Pg.lock(),
                Tuple.of(tenantCode, feedKey, externalCode)), PgFeedStore::service);
    }

    @Override
    public FeedService lockService(String tenantCode, String feedKey, String externalCode) {
        query(pool.get(), """
                INSERT INTO miot_trips.feed_service (tenant_code, feed_key, external_code, desired, desired_hash)
                VALUES ($1, $2, $3, '{}', '')
                ON CONFLICT (tenant_code, feed_key, external_code) DO NOTHING""",
                Tuple.of(tenantCode, feedKey, externalCode));
        return service(tenantCode, feedKey, externalCode).orElseThrow();
    }

    @Override
    public void saveService(FeedService s) {
        query(pool.get(), """
                INSERT INTO miot_trips.feed_service
                    (tenant_code, feed_key, external_code, desired, desired_hash, mandate_id, trip_id, open,
                     last_action, last_result, last_reconciled_at)
                VALUES ($1, $2, $3, $4::text::jsonb, $5, $6, $7, $8, $9, $10::text::jsonb, $11)
                ON CONFLICT (tenant_code, feed_key, external_code) DO UPDATE SET
                    desired = EXCLUDED.desired, desired_hash = EXCLUDED.desired_hash,
                    mandate_id = EXCLUDED.mandate_id, trip_id = EXCLUDED.trip_id, open = EXCLUDED.open,
                    last_action = EXCLUDED.last_action, last_result = EXCLUDED.last_result,
                    last_reconciled_at = EXCLUDED.last_reconciled_at, updated_at = now()""",
                Tuple.tuple().addString(s.tenantCode()).addString(s.feedKey()).addString(s.externalCode())
                        .addString(s.desired()).addString(s.desiredHash())
                        .addUUID(Pg.parse(s.mandateId())).addUUID(Pg.parse(s.tripId())).addBoolean(s.open())
                        .addString(s.lastAction()).addString(s.lastResult())
                        .addOffsetDateTime(s.lastReconciledAt()));
    }

    @Override
    public List<FeedService> dueServices(OffsetDateTime now, int retryMinutes, int limit) {
        return query(pool.get(), """
                SELECT s.* FROM miot_trips.feed_service s
                JOIN miot_trips.feed_profile p ON p.tenant_code = s.tenant_code AND p.feed_key = s.feed_key
                WHERE s.open AND p.active AND (
                    (s.last_action IN ('reportar', 'error', 'pendiente')
                        AND s.updated_at < $1::timestamptz - make_interval(mins => $2))
                    OR (s.last_action NOT IN ('reportar', 'error', 'pendiente') AND (
                           ((s.desired->>'plannedStart')::timestamptz <= $1::timestamptz
                            AND (s.last_reconciled_at IS NULL
                                 OR s.last_reconciled_at < (s.desired->>'plannedStart')::timestamptz))
                        OR (s.desired->>'plannedEnd')::timestamptz
                               + make_interval(mins => p.close_tolerance_minutes) <= $1::timestamptz)))
                ORDER BY s.last_reconciled_at NULLS FIRST
                LIMIT $3""", Tuple.of(now, retryMinutes, limit)).stream().map(PgFeedStore::service).toList();
    }

    private static FeedProfile profile(Row r) {
        return new FeedProfile(r.getString("tenant_code"), r.getString("feed_key"), r.getString("name"),
                Pg.json(r, "stages", STAGES), r.getString("departure_stage"), r.getString("close_stage"),
                r.getInteger("close_tolerance_minutes"),
                new LinkedHashSet<>(List.of(r.getArrayOfStrings("required_resources"))), r.getBoolean("active"),
                time(r, "created_at"), r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"));
    }

    private static FeedService service(Row r) {
        return new FeedService(r.getString("tenant_code"), r.getString("feed_key"), r.getString("external_code"),
                text(r, "desired"), r.getString("desired_hash"), text(r, "mandate_id"), text(r, "trip_id"),
                r.getBoolean("open"), r.getString("last_action"), text(r, "last_result"),
                time(r, "last_reconciled_at"));
    }

    private static <T> Optional<T> first(RowSet<Row> rows, Function<Row, T> map) {
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(map.apply(it.next())) : Optional.empty();
    }
}

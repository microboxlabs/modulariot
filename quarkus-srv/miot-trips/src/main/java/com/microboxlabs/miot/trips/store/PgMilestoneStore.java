package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.trips.domain.PendingMilestone;
import com.microboxlabs.miot.trips.domain.TripMilestone;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link MilestoneStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgMilestoneStore implements MilestoneStore {

    private static final String COLUMNS = "trip_id, milestone, tenant_code, status, source, proposed_at, evidence,"
            + " confirmed_at, confirmed_by, channel, note, updated_at, updated_by";
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
    };

    private final Supplier<Pool> pool;

    @Inject
    PgMilestoneStore(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgMilestoneStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<TripMilestone> list(String tenantCode, UUID tripId) {
        return query(pool.get(), "SELECT " + COLUMNS + " FROM miot_trips.trip_milestone"
                + " WHERE tenant_code = $1 AND trip_id = $2", Tuple.of(tenantCode, tripId))
                .stream().map(PgMilestoneStore::milestone).toList();
    }

    @Override
    public Optional<TripMilestone> find(String tenantCode, UUID tripId, String milestone) {
        return query(pool.get(), "SELECT " + COLUMNS + " FROM miot_trips.trip_milestone"
                + " WHERE tenant_code = $1 AND trip_id = $2 AND milestone = $3" + Pg.lock(),
                Tuple.of(tenantCode, tripId, milestone))
                .stream().map(PgMilestoneStore::milestone).findFirst();
    }

    @Override
    public List<PendingMilestone> pending(String tenantCode, int limit) {
        return query(pool.get(), """
                SELECT ms.trip_id, ms.milestone, ms.tenant_code, ms.status, ms.source, ms.proposed_at, ms.evidence,
                    ms.confirmed_at, ms.confirmed_by, ms.channel, ms.note, ms.updated_at, ms.updated_by,
                    (SELECT m.external_code FROM miot_trips.trip_mandate tm
                        JOIN miot_trips.mandate m ON m.id = tm.mandate_id
                        WHERE tm.trip_id = ms.trip_id AND tm.version_of IS NULL AND tm.is_active
                        ORDER BY tm.seq LIMIT 1) AS service_code,
                    o.name AS origin, d.name AS destination, t.planned_start
                FROM miot_trips.trip_milestone ms
                JOIN miot_trips.trip t ON t.id = ms.trip_id
                LEFT JOIN miot_trips.location o ON o.id = t.origin_id
                LEFT JOIN miot_trips.location d ON d.id = t.destination_id
                WHERE ms.tenant_code = $1 AND ms.status = 'pending'
                ORDER BY ms.proposed_at NULLS LAST, ms.updated_at LIMIT $2""", Tuple.of(tenantCode, limit))
                .stream().map(r -> new PendingMilestone(milestone(r), r.getString("service_code"),
                        r.getString("origin"), r.getString("destination"), time(r, "planned_start")))
                .toList();
    }

    @Override
    public TripMilestone save(TripMilestone m) {
        TripMilestone saved = query(pool.get(), """
                INSERT INTO miot_trips.trip_milestone (trip_id, milestone, tenant_code, status, source, proposed_at,
                    evidence, confirmed_at, confirmed_by, channel, note, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::text::jsonb, $8::timestamptz, $9, $10, $11, $12)
                ON CONFLICT (trip_id, milestone) DO UPDATE SET status = EXCLUDED.status, source = EXCLUDED.source,
                    proposed_at = EXCLUDED.proposed_at, evidence = EXCLUDED.evidence,
                    confirmed_at = EXCLUDED.confirmed_at, confirmed_by = EXCLUDED.confirmed_by,
                    channel = EXCLUDED.channel, note = EXCLUDED.note, updated_at = now(),
                    updated_by = EXCLUDED.updated_by
                RETURNING\s""" + COLUMNS,
                Tuple.tuple().addUUID(UUID.fromString(m.tripId())).addString(m.milestone())
                        .addString(m.tenantCode()).addString(m.status()).addString(m.source())
                        .addOffsetDateTime(m.proposedAt()).addString(Pg.json(m.evidence()))
                        .addOffsetDateTime(m.confirmedAt()).addString(m.confirmedBy()).addString(m.channel())
                        .addString(m.note()).addString(m.updatedBy()))
                .stream().map(PgMilestoneStore::milestone).findFirst().orElseThrow();
        if ("departure".equals(m.milestone())) {
            TripLiveChannel.changed(pool.get(), m.tenantCode(), m.tripId());
        }
        return saved;
    }

    private static TripMilestone milestone(Row r) {
        return new TripMilestone(r.getString("tenant_code"), Pg.text(r, "trip_id"), r.getString("milestone"),
                r.getString("status"), r.getString("source"), time(r, "proposed_at"), Pg.json(r, "evidence", MAP),
                time(r, "confirmed_at"), r.getString("confirmed_by"), r.getString("channel"), r.getString("note"),
                time(r, "updated_at"), r.getString("updated_by"));
    }
}
